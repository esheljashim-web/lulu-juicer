# Lulu Juicer: API Documentation and Reliability Spec

Companion to `lulu-juicer-dashboard-brief.md`. The brief says WHAT the business rules are. This file says HOW the system must behave so that the Telegram flow never fails, whatever the owner sends.

---

## 1. The one rule: Never reject, always save, then flag

The owner is unorganised. He will send wrong totals, typos, duplicates, edited messages, photos, voice notes and random text. The system cannot stop him doing that, but it can make sure **the system itself never fails because of it.**

| Situation | Wrong behaviour | Required behaviour |
|---|---|---|
| Totals do not add up | Reject / show error | Save it, mark `needs_review`, show the numbers on the dashboard with a badge |
| Unknown label | Crash / drop the line | Save as `Uncategorised`, show on Review |
| Message cannot be understood | Error reply | Save the raw message, reply "Saved, will check", show on Review |
| Same date sent twice | Duplicate rows / error | Update that day, keep the old version in history |
| App or database is down | Message lost | Telegram retries; message is processed later from the queue |

Definitions of "no error":
1. The webhook always returns HTTP 200 for any valid Telegram update.
2. Every message from an allowed sender gets a bot reply within 5 seconds.
3. Nothing the owner sends is ever lost: raw message is stored before any parsing.
4. The dashboard never shows a blank page or an error screen because of bad data. It shows the data it has plus a "needs review" count.
5. The bot never uses the words "error", "failed" or "invalid" in its replies to the owner.

---

## 2. Processing pipeline

```
Telegram ──► POST /api/telegram/webhook
                │ 1. verify secret header           (fail: 401, nothing else happens)
                │ 2. dedupe by update_id            (seen: return 200, stop)
                │ 3. allow-list check               (not allowed: return 200, stop, log)
                │ 4. SAVE RAW MESSAGE               (status = received)
                │ 5. return 200 immediately         (must be under ~1 second)
                ▼
            Background job (queue)
                │ 6. classify: slip / rent / salary list / purchase / voice / photo / other
                │ 7. parse (rules → LLM fallback → raw-only)
                │ 8. validate (checks from the brief, section 6)
                │ 9. upsert daily_slip + items inside ONE database transaction
                │ 10. write audit/version row
                │ 11. send bot reply (never throws; failure to reply is logged only)
                │ 12. publish "day updated" event to the app (realtime or polling)
                ▼
            Retry job (every 5 min, triggered by an external free scheduler, see section 14): re-process anything stuck in received / processing for over 2 minutes, max 5 tries, then status = needs_review + alert the builder
```

Raw message status values: `received → processing → parsed → needs_review → approved`, plus `ignored` (not allowed sender or irrelevant chat).

Rules:
- Step 4 happens before anything that can fail. If steps 6 to 12 crash, the raw message is still there and the retry job picks it up.
- Steps 6 to 12 are wrapped in a top-level try/catch. A thrown exception sets status `needs_review` with the error stored in `internal_error` (never shown to the owner).
- Step 9 is a single transaction: a day is either fully updated or not at all.
- Serverless note (Vercel or similar): do not do the parsing before returning the response. Use the platform's background execution (for example `waitUntil`) or a queue, plus the retry job so nothing depends on a single invocation finishing.

---

## 3. Telegram setup (exact requirements)

1. Create the bot with @BotFather. Store the token as an environment variable (`TELEGRAM_BOT_TOKEN`). Never put it in code or logs.
2. **Turn off privacy mode** (BotFather → `/setprivacy` → Disable) or make the bot a group admin. With privacy mode on, a bot in a group does NOT see normal messages, only commands. This is the most common reason "the bot does nothing". After changing it, remove and re-add the bot to the group.
3. Register the webhook:
   - `setWebhook` with `url=https://<app>/api/telegram/webhook`
   - `secret_token=<random string>`; Telegram then sends it in the header `X-Telegram-Bot-Api-Secret-Token` on every call. Reject requests without the exact value.
   - `allowed_updates=["message","edited_message"]`
   - `drop_pending_updates=false` (do not lose queued messages)
4. Handle both `message` and `edited_message`. An edit updates the same entry (same key, see section 4).
5. Allow-list: store Telegram user IDs allowed to send (owner, you). Optionally also lock to one `chat_id`. Anyone else is ignored silently (still return 200).
6. Photos arrive as `photo[]` (take the largest), voice as `voice` (OGG/Opus), and files via `getFile`; bots can download files up to 20 MB. Download inside the background job, not in the webhook.
7. Telegram retries a webhook that returns an error or times out, so repeated delivery of the same update is normal. Handle it with `update_id` dedupe (section 4).
8. Command set (optional, for the owner's phone): `/today` (today's totals), `/missing` (days with no slip), `/help` (shows the message template).

---

## 4. Idempotency and versions

- `telegram_updates(update_id PRIMARY KEY)`: if the insert conflicts, return 200 and stop.
- Natural key for a message: `(chat_id, message_id)`. An `edited_message` with the same key updates the stored raw text and re-runs the pipeline.
- The slip's own date header is the source of truth for which day it belongs to, NOT the time it was sent. (A slip for 20 Nov sent after midnight on 21 Nov still goes to 20 Nov.)
- If a new slip arrives for a date that already exists: write a new row in `daily_slip_versions` (full snapshot), update the live `daily_slips` row, and say so in the reply ("updated 20 Nov"). Nothing is deleted.
- If an `approved` day is changed by a new message, set it back to `needs_review` and keep the approved version in history.

---

## 5. Numbers the dashboard uses when data is messy

So the dashboard always shows something sensible:

| Value | Rule |
|---|---|
| Shop sales | The stated `Total on bill`. If missing: stated expenses + stated ATM. If those are missing: sum of items + sum of ATM entries. Mark the source. |
| Cash | Stated total expenses, else sum of items. |
| Card | Stated total ATM, else sum of ATM entries. |
| Category breakdown | Sum of expense items by category, plus an extra row **"Unreconciled"** = cash − sum(items), so categories always add up to the cash total. Can be negative. |
| Keeta / Talabat | Value if present, 0 if `blank` or missing. Keep `status` = value / blank / missing separately. |
| Unlabeled amount | Shown as its own line, not added to sales, until the owner explains it. |

---

## 6. Parser requirements (never throws)

- Input: any string up to 4,096 characters. Output: a result object, always. Wrapped so no exception can escape.
- Normalise before parsing: trim, collapse spaces, convert Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Persian digits to 0–9, convert `–` `—` `-` `:` between label and number to one separator, remove invisible Unicode (zero-width, LRM/RLM), treat `QR`, `QAR`, `ر.ق` as the currency, accept `1,041`, `1041`, `1 041`, `1.041` (flag the last one as ambiguous).
- Classification keywords: `Lulu Juicer |` header → slip; `Rent`, `Room rent`, `Kahrama`, `Phone`, `Sponsor` → fixed costs; `Staff Salary List` → staff list; `fruit` / `veg` → fruits & veg; `Sadia` → Sadia; anything else → `other` (save, review).
- Date parsing: `01 Nov 2026`, `1 november`, `07 novemever` (fuzzy month, match by first 3 letters), `14 nov`. If year is missing, use the message's year. If it cannot be read, use the message date and flag.
- Result fields: `kind`, `date`, `items[]`, `atm_entries[]`, `stated_totals`, `delivery`, `unlabeled`, `warnings[]`, `confidence`.
- Fallback order: rules → LLM extraction with strict JSON schema (validate the JSON; on invalid JSON, retry once, then give up) → raw-only with `needs_review`. LLM failure or timeout is never fatal.
- All money as integers.
- 100% of the real slips in `daily_slips_nov2026.csv` / `expense_items_nov2026.csv` must parse identically to the CSVs.

---

## 7. Bot replies (plain, calm, never "error")

| Case | Reply |
|---|---|
| All good | `✅ 21 Nov saved. Shop 3,560 · Keeta 65 · Talabat 124` |
| Small difference | `✅ 13 Nov saved. Small difference of 9 in the totals, will check.` |
| Big difference or unclear | `📝 13 Nov saved. Totals need a check, I will show it in the app.` |
| Updated a day | `🔄 20 Nov updated.` |
| Salary line without a name | `📝 Saved. Please add the staff name to the salary line next time.` |
| Voice / photo | `📝 Got it. I will read it and show it in the app for checking.` |
| Cannot understand | `📝 Saved. I could not read this one, it will show in the app for checking.` |
| Missing day (sent at 11 pm by the scheduler if no slip) | `⏰ No slip for 22 Nov yet.` |

Replies use `reply_to_message_id` so they attach to the right message. Sending a reply must never block or fail the saved data.

---

## 8. REST API (internal, used by the dashboard)

Base path `/api`. JSON in and out. Amounts are integers in QAR. Dates are `YYYY-MM-DD`. Auth for the dashboard: session login (owner role: read + review; admin role: everything). The Telegram webhook uses the secret header instead.

### Error response shape (for the dashboard only; the owner never sees these)

```json
{ "error": { "code": "VALIDATION", "message": "Readable text", "details": {} } }
```

Codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION` (422), `CONFLICT` (409, version changed since you loaded it), `INTERNAL` (500). The UI shows a friendly message and a retry button, never a stack trace.

### 8.1 Webhook

`POST /api/telegram/webhook`
- Header: `X-Telegram-Bot-Api-Secret-Token: <secret>`
- Body: Telegram `Update` object.
- Responses: `200 {"ok":true}` for every valid update (including duplicates and ignored senders). `401` only if the secret is wrong. Never `5xx` for content problems.

### 8.2 Days

`GET /api/days?from=2026-11-01&to=2026-11-30`
```json
{ "days": [ {
  "date": "2026-11-20",
  "shop_sales": 3444, "cash": 1361, "card": 2083,
  "keeta": 0, "keeta_status": "blank", "talabat": 266, "talabat_status": "value",
  "unlabeled": 0, "total_sales": 3710,
  "status": "ok", "flags": [], "version": 3
} ] }
```

`GET /api/days/{date}` returns the same plus `items[]`, `card_entries[]`, `raw_message`, `versions[]`.

`PUT /api/days/{date}` (manual edit or approve). Body includes `version` for conflict detection.
```json
{ "version": 3, "cash": 1361, "card": 2083, "keeta": 0, "talabat": 266,
  "items": [ { "label": "Rawabi", "amount": 100, "category": "Ingredients" } ],
  "status": "approved" }
```
Response `200` with the updated day, or `409 CONFLICT` with the current day.

### 8.3 Review queue

- `GET /api/review` → list of flagged days/messages with `reason`, `raw_text`, `parsed`, `suggested_fix`.
- `POST /api/review/{id}/resolve` body `{ "action": "approve" | "edit" | "ignore", "changes": {...} }`.

### 8.4 Paste box and import

- `POST /api/slips/preview` body `{ "text": "..." }` → parsed preview, nothing saved.
- `POST /api/slips/confirm` body `{ "text": "...", "overrides": {...} }` → saves (same pipeline as Telegram).
- `POST /api/import/whatsapp` multipart `file` (zip) → processes `_chat.txt`, skips dates already saved, returns `{ "imported": 18, "skipped": 2, "needs_review": 4 }`.

### 8.5 Reports

`GET /api/reports/month?month=2026-11` → totals using the formula in the brief, section 2.
```json
{ "month": "2026-11", "days_with_data": 20, "days_missing": ["2026-11-21"],
  "sales": { "shop": 69715, "keeta": 791, "talabat": 2014, "total": 72520 },
  "cash": 29605, "card": 40112,
  "costs": { "cash_counter": 29605, "online_purchases": 9759, "fixed": 20112, "salary_remaining": 20700, "delivery_commission": 0 },
  "profit_estimate": -7656,
  "data_quality": { "needs_review_days": 4, "unlabeled_total": 414 } }
```
(The example uses the November 1–20 seed data only: 20 days of sales against a full month of fixed costs and salaries, so the profit figure is not a real month result. `salary_remaining` = 23,000 − 1,800 (Mijan) − 500 (Basheer); the unnamed 400 cannot be matched to anyone yet.)

### 8.6 Master data

`GET/POST/PUT /api/staff`, `/api/aliases`, `/api/fixed-costs`, `/api/purchases`, `/api/settings` with standard CRUD. `aliases` maps labels to category/supplier/staff, so renames are done in the app and past data re-categorises without re-parsing.

### 8.7 Operations

- `GET /api/health` → `{ "ok": true, "db": true, "telegram_webhook": true, "queue_pending": 0, "last_message_at": "..." }`
- `POST /api/jobs/reprocess` (scheduler or admin) → re-runs stuck messages. Also `POST /api/jobs/daily-check` and `POST /api/jobs/backup`. All `/api/jobs/*` require the header `Authorization: Bearer <CRON_SECRET>`.
- `POST /api/messages/{id}/reparse` → re-parses one raw message with the current rules.

---

## 9. Live update in the app

When step 12 of the pipeline finishes, the dashboard updates without a manual refresh.
- Preferred: realtime subscription on `daily_slips` (for example Supabase Realtime) or Server-Sent Events.
- Fallback: poll `GET /api/days?from=<this month>` every 15 seconds while the page is open.
- A small toast: "20 Nov updated".

---

## 10. Monitoring and alerts (so you find problems before the owner does)

- A separate private Telegram chat or channel for **you** (admin). The system sends there: any message that ended in `needs_review` because of an internal exception, a stuck queue (over 10 minutes), webhook not registered, bot token rejected, database errors, three days in a row with no slip.
- `GET /api/health` is checked every 5 minutes by an uptime monitor.
- Daily check at 11 pm Qatar time (UTC+3), triggered by the external free scheduler in section 14: if no slip for today, send the reminder to the group (section 7).
- Log structured JSON per message: `message_id`, `status`, `duration_ms`, `warnings`. Never log the bot token or secret.
- Weekly backup of the database; keep the raw messages table forever.

---

## 11. Security

- Webhook secret header; allow-list of Telegram user IDs; ignore everyone else.
- Dashboard login. Roles: `owner` (view, review, approve) and `admin` (settings, staff, imports).
- Environment variables for secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DATABASE_URL`, LLM key).
- Staff salaries are sensitive: only the `owner` and `admin` roles can see them.
- Rate limit the REST API; the webhook is protected by the secret.

---

## 12. Test plan and acceptance criteria

**Unit tests (parser)**
1. All 20 real slips parse to the exact values in the two CSV files.
2. Variations: single-line ATM, `Subtotal` plus `Additional ATM entry`, `Expense total on slip`, `Keeta – blank`, missing Keeta or Talabat line, `Unlabeled amount`, `Check:` notes.
3. Messy inputs: Arabic digits, `1.041`, no commas, extra spaces, lower-case labels, `QR`, wrong dash, typos in month (`novmber`, `novemever`), missing year, emoji, very long text, empty text, text with only a number.
4. Garbage input (stickers, random sentences, other languages) returns a result with `kind: other`, never an exception.

**Integration tests (webhook)**
5. Same `update_id` sent 5 times → one saved message, five `200` responses.
6. Edited message → same day updated, version history has both.
7. Sender not on the allow-list → `200`, nothing saved, no reply.
8. Wrong secret header → `401`.
9. Database temporarily down → raw message retried and processed later; no message lost.
10. LLM down or returns invalid JSON → falls back to raw-only, `needs_review`, no crash.
11. Bot reply fails (Telegram API error) → data still saved.
12. Two slips for the same date within seconds → last write wins, both kept in versions.

**Load / fuzz**
13. 1,000 mixed and random messages through the webhook: zero `5xx`, every allowed message has a stored raw row.

**Acceptance (must all pass before giving it to the owner)**
- Tests 1 to 13 green.
- A real Telegram test group: send each of the 20 slips, check the day appears in the app within 10 seconds and the bot reply is correct.
- Turn the app off for 5 minutes, send 3 slips, turn it back on: all 3 appear.
- Send a photo and a voice note: both are saved and appear on Review.

---

## 13. Documentation files the agent must create

| File | Content |
|---|---|
| `agents.md` | Purpose, definitions, the "never reject, always save, then flag" rule, file map. Read first by every agent. |
| `docs/API.md` | Section 8 of this file, kept in sync with the code (ideally generated from an OpenAPI file, `openapi.yaml`). |
| `docs/TELEGRAM_SETUP.md` | Section 3 as step-by-step instructions, with the exact BotFather steps. |
| `docs/PIPELINE.md` | Section 2 with the status diagram. |
| `docs/DATA_DICTIONARY.md` | Every table and field. |
| `docs/RUNBOOK.md` | What to do when: bot silent, messages stuck, wrong totals, token rotated, webhook lost. |
| `docs/OWNER_GUIDE.md` | One page for the owner, in simple English: how to send the slip (template), what the bot replies mean. |
| `CHANGELOG.md` | One line per change. |

---

## 14. Free stack on Vercel Hobby (everything at zero cost)

The design above works on free tiers. Free tiers change, so check the current limits in each dashboard before launch.

### 14.1 Stack

| Need | Free choice | Notes |
|---|---|---|
| App + API + webhook | **Vercel Hobby**, Next.js (App Router, route handlers under `app/api`) | Function max duration is 300 s on Hobby; keep every job under about 30 s. Return the webhook response first, then continue with `after()` / `waitUntil`. |
| Database | **Supabase free** (Postgres + Realtime) or **Neon free** | The data is tiny (about 30 slips a month). Free projects can be paused after a long period without activity; daily slips plus the health check keep it active. |
| Live updates | Supabase Realtime, or polling every 15 s | Polling needs no extra service. |
| AI parsing, photos, voice | **Gemini API free tier** (key from Google AI Studio) | Rules parser runs first, so the AI is rarely called. Count calls per day; on a rate-limit reply fall back to raw-only (`needs_review`). Check whether free-tier prompts may be used by Google to improve products, because slips contain salary information. If that is a problem, keep photos and voice as manual review items. |
| Telegram bot + admin alerts | Telegram Bot API | Free. |
| Scheduling (retry every 5 min, daily 11 pm check, backup) | **cron-job.org** (free) calling `/api/jobs/*` with the bearer secret | Do not depend on Vercel's own cron on Hobby. Its Hobby schedules are limited (legacy cron jobs once a day with loose timing; the newer Schedules feature at most every 15 minutes). Keep one Vercel cron in `vercel.json` once a day as a backup only. |
| Uptime check | **UptimeRobot** (free) on `/api/health` | Alerts you by email or Telegram. |

### 14.2 Hobby limits the code must design around

1. **Runtime logs on Hobby are kept for only 1 hour.** So the app must write its own logs: table `app_logs(at, level, message_id, event, details)`, deleted after 30 days. The runbook must say "look in `app_logs`", not in Vercel logs.
2. **No background workers.** Everything is a short function call. The retry job and the database status column (section 2) are what make this safe.
3. **Cold starts**: the first call after quiet time can take a couple of seconds. This is fine because the webhook only saves the raw message and returns 200.
4. **Free-tier database backups may be limited or manual.** Add `POST /api/jobs/backup`: exports all tables as CSV into a downloadable file for the admin page, run weekly by cron-job.org. Also keep the Telegram group history; it is a free second copy of every raw slip.
5. **Invocation volume** is far below the free allowance (a few hundred requests a day).

### 14.3 Commercial-use warning (read before launch)

Vercel's terms restrict the Hobby plan to non-commercial, personal use. A dashboard for a friend's shop may count as commercial use, especially if you are paid for it or plan to offer it to other businesses. Decide this before launch. To stay free either way, keep the app portable: standard Next.js, Postgres through a plain connection string, no Vercel-only features. Then it can move to another free host if needed.

### 14.4 Environment variables

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_USER_IDS`, `TELEGRAM_ADMIN_CHAT_ID`, `DATABASE_URL`, `CRON_SECRET`, `GEMINI_API_KEY`, `APP_BASE_URL`, `SESSION_SECRET`. Set them in the Vercel project settings, never in the code or the repository.

### 14.5 Free setup order (no card needed)

1. Create the GitHub repository and the Vercel project; deploy a blank Next.js app.
2. Create the free database; run the schema; set `DATABASE_URL`.
3. Create the Telegram bot (BotFather), disable privacy mode, set the environment variables.
4. Deploy; call `setWebhook` with the secret token (section 3).
5. Set up cron-job.org (every 5 min `reprocess`, daily 23:00 Qatar time `daily-check`, weekly `backup`) and UptimeRobot.
6. Import November (CSV seed), then send one real slip in the Telegram group and check the acceptance list in section 12.

---

## 15. Hybrid parser: rules first, AI optional

AI must never be required for the app to work. Free AI limits are per project, differ by model, are not guaranteed, and models get retired, so the app has to behave the same when AI is slow, limited or gone.

### 15.1 Roles

| Layer | Job |
|---|---|
| Rules parser | Reads normal slips. Fast, free, same result every time. Must parse all 20 fixture slips with AI turned off. |
| AI fallback | Reads only what the rules cannot: photos, voice transcripts, changed layouts, free text. It extracts numbers and labels into the strict JSON schema, nothing else. |
| Code | Does all arithmetic and every validation (cash + card = total on bill). AI never calculates or approves. |
| Human | Approves anything AI read. An AI-parsed day is always `needs_review` until approved. |

### 15.2 Settings and safety switches

- `AI_ENABLED` (true/false). With false, nothing calls AI and all 20 fixtures still parse.
- `AI_MODEL` in an environment variable (never hardcoded), so a retired model is a one-line change.
- `AI_DAILY_CALL_CAP` and an 8-second timeout per call.
- On any AI failure (limit, timeout, invalid JSON, model removed): save the raw message, set `needs_review`, reply "Saved, will check". Never an error to the owner.
- Optional second free provider as a further fallback, only after its current free terms are checked.

### 15.3 Learning from approvals

When AI suggests a label or category and a human approves it in Review, store it in `label_aliases`. Next time the rules parser handles that label with no AI call. AI use shrinks over time.

### 15.4 Shadow mode

`AI_SHADOW=true` runs the AI in the background on normal slips. Its result is never saved. Every disagreement with the rules parser is logged in `app_logs` (event `ai_shadow_diff`). Use it for the first two weeks to measure reliability before trusting AI with anything.

### 15.5 Tests

1. `AI_ENABLED=false`: all 20 fixture slips parse to the expected values.
2. AI returns invalid JSON, times out, or returns a 429: message saved, `needs_review`, bot reply sent, no exception.
3. AI result that fails the cash + card = total check is flagged.
4. Approving an AI label creates an alias, and the same label is then parsed by rules without an AI call.
