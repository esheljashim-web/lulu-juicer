# Telegram Bot Setup Guide — Lulu Juicer Dashboard

> **Purpose:** Exact, step-by-step instructions to get the Telegram bot connected to the app. Follow every step in order. Skipping any step is the most common reason "the bot does nothing".

---

## Prerequisites

Before starting you need:
- The deployed app URL (e.g. `https://lulu-juicer.vercel.app`) — the webhook URL will not work on localhost.
- Access to the Vercel project environment variables panel (or wherever secrets are stored).
- A Telegram account to create the bot.

---

## Step 1 — Create the Bot with @BotFather

1. Open Telegram and search for `@BotFather`.
2. Send: `/newbot`
3. BotFather asks for a **name** (display name, e.g. `Lulu Juicer`).
4. BotFather asks for a **username** (must end in `bot`, e.g. `LuluJuicerBot`).
5. BotFather replies with your **Bot Token**. It looks like: `7123456789:AAFabc123defGHI456jklMNO789pqrSTU0vwx`
6. **Copy the token immediately.** Store it as the environment variable `TELEGRAM_BOT_TOKEN`. Never paste it into code, a chat message, or a log.

---

## Step 2 — Disable Privacy Mode ⚠️ (Critical — most common mistake)

By default, a Telegram bot inside a **group** only receives messages that start with `/` (commands). It will silently ignore all normal slip messages.

To fix this:

1. Send `/setprivacy` to `@BotFather`.
2. Choose your bot (`@LuluJuicerBot`).
3. BotFather asks: *"What privacy mode should be enabled?"*  Select **Disable**.
4. BotFather confirms: *"Success! Privacy mode is now disabled."*

> **Important:** If you already added the bot to the group before disabling privacy mode, you must **remove the bot from the group and re-add it**. The setting only takes effect at the moment the bot joins.

---

## Step 3 — Get the Telegram User IDs for the Allow-List

The bot ignores everyone not on the allow-list. You need the numeric Telegram user IDs of:
- The shop owner.
- You (the developer/admin).

How to get a user ID:
1. Add `@userinfobot` to the Telegram group (or message it privately).
2. Send `/start` or forward a message from the person whose ID you need.
3. It replies with the numeric ID, e.g. `1234567890`.

Store the IDs comma-separated as the environment variable `TELEGRAM_ALLOWED_USER_IDS`:
```
TELEGRAM_ALLOWED_USER_IDS=1234567890,9876543210
```

---

## Step 4 — Get the Admin Chat ID (for system alerts)

The system sends silent admin alerts (stuck queues, errors, missing slips) to a **separate private chat**, not the owner's group.

Options:
- Create a private Telegram channel or group for yourself.
- Or just use your own user ID (then alerts come as direct messages from the bot).

How to get a chat/group ID:
1. Add the bot to the private alert channel/group.
2. Send a message in that chat.
3. Visit in your browser: `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates`
4. Find `"chat":{"id": -1001234567890, ...}` — this negative number is the chat ID.

Store it as: `TELEGRAM_ADMIN_CHAT_ID=-1001234567890`

---

## Step 5 — Generate the Webhook Secret

This secret is a random string you create. Telegram will send it in a header with every webhook call. The app checks it and rejects requests without it (`401`). This protects your endpoint from anyone who guesses the URL.

Generate a secure random string (at least 32 characters). One way on any terminal:
```
openssl rand -hex 32
```
Example output: `a3f8c9d1e2b7044f9c8a1d2e3f4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2`

Store it as: `TELEGRAM_WEBHOOK_SECRET=<your random string>`

---

## Step 6 — Set Environment Variables

Set all of the following in your hosting platform (Vercel project → Settings → Environment Variables):

| Variable | Description | Example |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token from BotFather | `7123...vwx` |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret you generated | `a3f8c9...` |
| `TELEGRAM_ALLOWED_USER_IDS` | Comma-separated numeric user IDs | `1234567890,9876543210` |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID for admin alerts | `-1001234567890` |
| `DATABASE_URL` | Postgres connection string | `postgresql://user:pass@host/db` |
| `CRON_SECRET` | Bearer token for cron-job.org calls | `another random string` |
| `GEMINI_API_KEY` | Google AI Studio key (optional, AI disabled if absent) | `AIza...` |
| `APP_BASE_URL` | Full URL of the deployed app | `https://lulu-juicer.vercel.app` |
| `SESSION_SECRET` | Secret for dashboard login sessions | `another random string` |

> **Never** put any of these values in source code or commit them to a git repository.

---

## Step 7 — Register the Webhook with Telegram

After deploying the app, call Telegram's `setWebhook` API **once**. Use this exact URL in your browser or with curl:

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
  ?url=https://<your-app-domain>/api/telegram/webhook
  &secret_token=<TELEGRAM_WEBHOOK_SECRET>
  &allowed_updates=["message","edited_message"]
  &drop_pending_updates=false
```

Replace `<TELEGRAM_BOT_TOKEN>` and `<TELEGRAM_WEBHOOK_SECRET>` with your actual values.

Telegram responds:
```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

If you see `ok: false`, check that:
- The app URL is publicly accessible (not localhost).
- The URL uses `https://` (Telegram rejects plain `http://`).
- The domain has a valid TLS certificate (Vercel provides this automatically).

---

## Step 8 — Verify the Webhook is Active

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "https://lulu-juicer.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null,
    "last_error_message": null,
    "max_connections": 40,
    "allowed_updates": ["message", "edited_message"]
  }
}
```

If `last_error_message` is not null, something is wrong. Common errors:

| Telegram Error Message | Cause | Fix |
|---|---|---|
| `SSL certificate problem` | App not on HTTPS or cert invalid | Use Vercel (auto HTTPS) or fix cert |
| `Connection refused` | App not deployed or URL wrong | Check the URL in browser first |
| `Wrong response from webhook: 403` | Webhook secret does not match | Regenerate and re-register |
| `Wrong response from webhook: 500` | App threw an uncaught exception | Check app logs / `app_logs` table |

---

## Step 9 — Add the Bot to the Owner's Group

1. Open the Telegram group the owner uses to send slips.
2. Add `@LuluJuicerBot` as a member.
3. Make the bot a **group admin** (alternative to disabling privacy mode — if you did Step 2 already, this is optional but recommended for reliability).

---

## Step 10 — Send a Test Slip

Send this exact text in the group:

```
Lulu Juicer | 23 Nov 2026
Expenses (QAR)
Rawabi – 500
PT – 20
Total expenses – 520

ATM (QAR)
300
220
Total ATM – 520

Total on bill – QAR 1,040
Keeta – 50
Talabat – 30
```

Expected bot reply within 5 seconds:
```
✅ 23 Nov saved. Shop 1,040 · Keeta 50 · Talabat 30
```

If there is no reply within 10 seconds:
1. Check `GET /api/health` → look at `telegram_webhook` and `queue_pending`.
2. Check the `app_logs` table for `event = webhook_received` and `event = parse_complete`.
3. Check `getWebhookInfo` for `last_error_message`.

---

## Step 11 — Set Up the Bot Commands (Optional but Recommended)

Send to @BotFather: `/setcommands`  
Choose your bot, then paste:

```
today - Show today's totals
missing - List days with no slip
help - Show the message template
```

The owner can then type `/today` in the group and get the latest numbers without opening the app.

---

## Removing or Updating the Webhook

To delete the webhook (e.g. for local testing):
```
https://api.telegram.org/bot<TOKEN>/deleteWebhook
```

To update the URL (e.g. after a domain change):
Just call `setWebhook` again with the new URL. The old one is replaced.

---

## Common "Bot Does Nothing" Checklist

- [ ] Privacy mode disabled AND bot was removed and re-added to group after disabling
- [ ] `TELEGRAM_BOT_TOKEN` env variable set correctly (no extra spaces)
- [ ] `TELEGRAM_WEBHOOK_SECRET` env variable matches what was sent to `setWebhook`
- [ ] App deployed and publicly accessible via HTTPS
- [ ] `getWebhookInfo` shows no `last_error_message`
- [ ] Sender's Telegram user ID is in `TELEGRAM_ALLOWED_USER_IDS`
- [ ] Bot is a member of the group (or admin)
- [ ] `DATABASE_URL` is set and the database is running
