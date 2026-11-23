# Runbook — Lulu Juicer Dashboard

> What to do when something goes wrong. For the developer/admin. The owner should never need to read this.
> Always check `app_logs` first — Vercel runtime logs are only kept for 1 hour.

---

## 1. The Bot is Silent (Owner Sends a Slip, No Reply)

Work through this checklist in order:

### 1a — Is the bot even receiving messages?
Check: `GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

- `last_error_message` is not null → see the error table below.
- `pending_update_count` is high → the bot is receiving but the app is crashing before saving.

### 1b — Is the app up?
Check: `GET https://<app-domain>/api/health`

- `ok: false` or connection refused → app is down. Check Vercel deployment status.
- `db: false` → app is up but database is down. Check Supabase/Neon status page.

### 1c — Is the message being saved?
In the database:
```sql
SELECT * FROM raw_messages ORDER BY received_at DESC LIMIT 5;
```
- Row exists with `status = received` → background job is not running. Check `queue_pending` in health.
- Row exists with `status = processing` for > 2 minutes → job is stuck. Run `POST /api/jobs/reprocess`.
- No row → webhook is not receiving the message at all. Go to 1a.

### 1d — Is the sender on the allow-list?
```sql
SELECT * FROM app_logs WHERE event = 'sender_ignored' ORDER BY at DESC LIMIT 5;
```
If found: add the sender's Telegram user ID to `TELEGRAM_ALLOWED_USER_IDS` env var and redeploy (or update the `settings` table).

### 1e — Is privacy mode still on?
If the bot was added to a group before privacy mode was disabled:
1. Remove the bot from the group.
2. Confirm privacy mode is off: BotFather → `/setprivacy` → should say `Disabled`.
3. Re-add the bot to the group.

### Webhook Error Reference

| `last_error_message` | Cause | Fix |
|---|---|---|
| `SSL certificate verify failed` | App not on HTTPS | Use Vercel (auto HTTPS) |
| `Connection refused` | App not deployed / URL wrong | Check URL, check Vercel |
| `Wrong response from webhook: 401` | Secret token mismatch | Re-register webhook with correct secret |
| `Wrong response from webhook: 500` | Uncaught exception in app | Check `app_logs`, fix the bug, redeploy |
| `Wrong response from webhook: 404` | Route `/api/telegram/webhook` does not exist | Check routing, redeploy |
| `Timed out` | Webhook did not return 200 within 60s | The webhook must save and return 200 in < 1s. Parsing must be in the background job. |

---

## 2. A Message is Stuck (status = received or processing for > 10 minutes)

The retry job runs every 5 minutes automatically. If it's not helping:

1. Check how many retries: `SELECT retry_count, internal_error FROM raw_messages WHERE id = '<id>';`
2. If `retry_count >= 5`: the message has exhausted retries and is `needs_review`. Open the Review screen to handle it manually.
3. If `internal_error` is set: read the error. It's the exception from the last attempt.
4. Force one retry: `POST /api/messages/<id>/reparse` (admin role).
5. If all else fails: open the Review screen, read the raw text, and manually enter the values.

---

## 3. A Slip Parsed with Wrong Numbers

**The owner calls and says "the numbers are wrong":**

1. Go to Review screen → find the date.
2. Compare `raw_message.text` (the original) to what was parsed.
3. If the slip itself had a typo → note it in `reason`, approve with the correct numbers. The original is preserved.
4. If the parser misread it → fix the alias in Settings → Aliases, then `POST /api/messages/<id>/reparse`.
5. All edits are logged in `audit_log`.

**Never silently change a number.** Always record why in the `reason` field.

---

## 4. The Bot Token was Compromised or Rotated

If you need to generate a new bot token:

1. BotFather → `/revoke` → confirm. Old token stops working immediately.
2. BotFather gives new token.
3. Update `TELEGRAM_BOT_TOKEN` env var in Vercel. Redeploy.
4. Re-register the webhook: `POST setWebhook` with the new token (same URL, same secret).
5. Check `getWebhookInfo` to confirm.

**Note:** If the token was compromised, also rotate `TELEGRAM_WEBHOOK_SECRET` and `CRON_SECRET` and redeploy.

---

## 5. The Webhook URL Changed (e.g. domain change)

1. Update `APP_BASE_URL` env var.
2. Call `setWebhook` with the new URL.
3. Confirm with `getWebhookInfo`.
4. Update cron-job.org job URLs to the new domain.
5. Update UptimeRobot monitor URL.

---

## 6. Database is Full or Paused (Supabase/Neon Free Tier)

Free database projects can be paused after extended inactivity (Supabase pauses after 1 week, Neon after 5 days on free tier).

**Signs:** `GET /api/health` shows `db: false`. `app_logs` shows database connection errors.

**Fix:**
1. Log into Supabase or Neon dashboard.
2. Resume/restore the project. Usually takes < 60 seconds.
3. The retry job will process any messages that arrived while the DB was down (Telegram queues updates for up to 48h).

**Prevention:** The `/api/health` endpoint (checked every 5 min by UptimeRobot) and the daily check job (11 PM daily) both touch the database, keeping it active.

---

## 7. Gemini API Limit Hit (AI Parsing Fails)

**Signs:** Slips that don't match the rule-based parser are showing as `needs_review` with `internal_error` containing `429 Resource Exhausted`.

**Fix:**
1. The app automatically falls back to `raw-only` + `needs_review` when AI fails. No data is lost.
2. Check `app_logs` for `event = parse_fallback_ai` to see how often AI is being called.
3. If daily cap is being hit: increase `ai_daily_call_cap` in Settings (check Google AI Studio dashboard for actual limits), or temporarily set `ai_enabled = false`.
4. The retry job will not re-call AI for the same message more than once per retry cycle.

---

## 8. cron-job.org Jobs are Not Running

Signs: Stuck messages not being retried; no missing-slip reminders.

Check:
1. Log into cron-job.org and check the job execution history.
2. Check the job URL is correct (new domain after a migration?).
3. Check the `Authorization: Bearer <CRON_SECRET>` header matches the current env var.
4. Check `GET /api/health` → `queue_pending` count — if high, jobs are not running.

**Manual trigger:** You can call the job endpoints manually from a browser or curl (with the correct Bearer token) to unstick things.

---

## 9. Three Days in a Row with No Slip

The system sends an admin alert automatically after 3 consecutive days with no slip. If you receive it:

1. Contact the owner to check if the bot is working.
2. Check the group: has the bot been removed?
3. Run through checklist #1 (Bot is Silent).
4. If the owner sent slips via WhatsApp instead, use the paste box or WhatsApp import to catch up.

---

## 10. How to Add a New Allowed Sender

If a new person (e.g. a manager) should be able to send slips:

1. Get their Telegram numeric user ID (use `@userinfobot`).
2. Add to `TELEGRAM_ALLOWED_USER_IDS` env var (comma-separated). Redeploy.
3. OR: update the `settings` table key `telegram_allowed_user_ids` (takes effect immediately without redeploy).

---

## 11. Weekly/Monthly Maintenance

| Task | When | How |
|---|---|---|
| Review the Review queue | Weekly | Dashboard → Review. Approve or fix pending items. |
| Confirm open questions | Whenever owner responds | Update `OPEN_QUESTIONS.md`. Add aliases in Settings. |
| Check `app_logs` for `warn` and `error` events | Weekly | `SELECT * FROM app_logs WHERE level IN ('warn','error') ORDER BY at DESC LIMIT 50;` |
| Download backup | Weekly (cron-job.org does this) | Admin page → Backups, or `POST /api/jobs/backup`. |
| Verify cron-job.org jobs ran | Weekly | cron-job.org dashboard → check execution history. |
| Check UptimeRobot | Weekly | Uptime % should be > 99%. |
| Prune old `app_logs` | Monthly (auto) | Rows older than 30 days are deleted by the daily check job. |
