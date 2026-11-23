# API Reference — Lulu Juicer Dashboard

> Internal API used by the dashboard. Base path: `/api`. All bodies are JSON. All amounts are integers in QAR. All dates are `YYYY-MM-DD`.

---

## Authentication

| Caller | Method |
|---|---|
| Dashboard (owner/admin) | Session cookie. Login at `POST /api/auth/login`. |
| Telegram webhook | `X-Telegram-Bot-Api-Secret-Token` header. Must match `TELEGRAM_WEBHOOK_SECRET`. |
| Cron jobs | `Authorization: Bearer <CRON_SECRET>` header. |

**Roles:**
- `owner`: view all data, use Review screen, approve/edit days.
- `admin`: everything owner can do, plus Settings, staff management, alias editing, import.

---

## Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Human-readable description",
    "details": {}
  }
}
```

| HTTP Code | Error Code | When |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Not logged in, or wrong webhook secret. |
| 403 | `FORBIDDEN` | Logged in but role cannot do this. |
| 404 | `NOT_FOUND` | Resource does not exist. |
| 409 | `CONFLICT` | Version mismatch on a PUT (optimistic lock). |
| 422 | `VALIDATION` | Request body is structurally wrong. |
| 500 | `INTERNAL` | Unexpected server error. UI shows a friendly message + retry button. Never shows a stack trace. |

The dashboard UI **never shows raw error codes** to the owner. It shows a friendly message and a retry button.

---

## Webhook

### `POST /api/telegram/webhook`

Receives updates from Telegram. Must return 200 within ~1 second.

**Headers required:**
```
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
```

**Responses:**

| Condition | HTTP | Body |
|---|---|---|
| Wrong or missing secret | 401 | (empty) |
| Any valid update (including duplicates, ignored senders, errors after Step 4) | 200 | `{"ok":true}` |

The response is always 200 for any valid Telegram update. 401 is the only exception, and only for wrong secrets.

---

## Days

### `GET /api/days`

List of daily slips for a date range.

**Query params:**
- `from` (required): `YYYY-MM-DD`
- `to` (required): `YYYY-MM-DD`

**Response 200:**
```json
{
  "days": [
    {
      "date": "2026-11-20",
      "shop_sales": 3444,
      "cash": 1361,
      "card": 2083,
      "keeta": 0,
      "keeta_status": "blank",
      "talabat": 266,
      "talabat_status": "value",
      "unlabeled": 0,
      "total_sales": 3710,
      "flag": "ok",
      "status": "ok",
      "version": 1
    }
  ],
  "missing_dates": ["2026-11-21", "2026-11-22"],
  "needs_review_count": 4
}
```

`missing_dates` lists business dates in the range with no slip at all.

---

### `GET /api/days/{date}`

Full detail for one day including expense items and card entries.

**Response 200:**
```json
{
  "date": "2026-11-20",
  "shop_sales": 3444,
  "cash": 1361,
  "card": 2083,
  "keeta": 0,
  "keeta_status": "blank",
  "talabat": 266,
  "talabat_status": "value",
  "unlabeled": 0,
  "total_sales": 3710,
  "flag": "ok",
  "status": "ok",
  "version": 1,
  "cash_expenses_stated": 1361,
  "cash_expenses_calc": 1361,
  "card_atm_stated": 2083,
  "card_atm_calc": 2083,
  "bill_diff": 0,
  "items_diff": 0,
  "atm_diff": 0,
  "items": [
    { "id": "uuid", "label_raw": "Rawabi", "label_normalized": "Rawabi", "category": "Ingredients", "amount": 100, "is_salary": false },
    { "id": "uuid", "label_raw": "Mijan salary", "label_normalized": "Meezan", "category": "Salary", "amount": 200, "is_salary": true, "staff_id": "uuid" }
  ],
  "card_entries": [
    { "id": "uuid", "amount": 952 },
    { "id": "uuid", "amount": 79 },
    { "id": "uuid", "amount": 442 },
    { "id": "uuid", "amount": 610 }
  ],
  "raw_message": {
    "id": "uuid",
    "text": "Lulu Juicer | 20 Nov 2026\n...",
    "received_at": "2026-11-20T18:30:00Z",
    "source": "telegram"
  },
  "versions": [
    { "version": 1, "created_at": "2026-11-20T18:30:05Z" }
  ]
}
```

**Response 404:** Date has no slip.

---

### `PUT /api/days/{date}`

Manual edit or approve a day. Requires `owner` or `admin` role.

**Body:**
```json
{
  "version": 1,
  "cash": 1361,
  "card": 2083,
  "keeta": 0,
  "keeta_status": "blank",
  "talabat": 266,
  "items": [
    { "label": "Rawabi", "amount": 100, "category": "Ingredients" }
  ],
  "status": "approved",
  "reason": "Owner confirmed amounts correct"
}
```

`version` is required. If the row's current version doesn't match, the response is `409 CONFLICT` with the current row.

**Response 200:** Updated day object (same shape as GET).

**Response 409:**
```json
{
  "error": { "code": "CONFLICT", "message": "This day was updated since you loaded it." },
  "current": { ... current day object ... }
}
```

---

## Review Queue

### `GET /api/review`

All flagged days and unprocessable messages requiring human attention.

**Response 200:**
```json
{
  "count": 4,
  "items": [
    {
      "id": "uuid",
      "type": "daily_slip",
      "date": "2026-11-01",
      "flag": "needs_review",
      "reasons": [
        "Items sum 2,001 but stated total 1,977 (diff +24)",
        "ATM entries sum 1,676 but stated 1,670 (diff +6)",
        "Salary line 'Salary (name unclear) – 400' has no staff member matched"
      ],
      "raw_text": "Lulu Juicer | 01 Nov 2026\n...",
      "parsed": { ... current parsed values ... },
      "suggested_fix": null
    }
  ]
}
```

---

### `POST /api/review/{id}/resolve`

Resolve a review item. Requires `owner` or `admin` role.

**Body:**
```json
{
  "action": "approve",
  "changes": {},
  "reason": "Owner confirmed the totals are correct as written"
}
```

```json
{
  "action": "edit",
  "changes": {
    "cash_expenses_stated": 1977,
    "items": [ { "label": "Salary (name unclear)", "staff_id": "uuid-basheer", "amount": 400 } ]
  },
  "reason": "Owner said the unlabeled salary was Basheer"
}
```

```json
{
  "action": "ignore",
  "reason": "Test message, not a real slip"
}
```

**Response 200:** `{ "ok": true }`

---

## Paste Box & Import

### `POST /api/slips/preview`

Preview what the parser reads from a pasted text. Nothing is saved.

**Body:**
```json
{ "text": "Lulu Juicer | 23 Nov 2026\nExpenses (QAR)\nRawabi – 500\n..." }
```

**Response 200:** Full parsed result object (same shape as `GET /api/days/{date}`) plus `"saved": false`.

---

### `POST /api/slips/confirm`

Save a pasted slip. Runs the same pipeline as the Telegram webhook.

**Body:**
```json
{
  "text": "Lulu Juicer | 23 Nov 2026\n...",
  "overrides": {
    "keeta": 50,
    "keeta_status": "value"
  }
}
```

**Response 200:** Saved day object.
**Response 409:** A slip for this date already exists. Response includes existing day. Use PUT to update.

---

### `POST /api/import/whatsapp`

Upload a WhatsApp chat export ZIP file. Processes all slips found, skips dates already saved.

**Body:** `multipart/form-data` with field `file` (ZIP, max 50 MB).

**Response 200:**
```json
{
  "imported": 18,
  "skipped": 2,
  "needs_review": 4,
  "dates_imported": ["2026-11-01", "2026-11-02", "..."],
  "dates_skipped": ["2026-11-20", "2026-11-21"],
  "dates_needs_review": ["2026-11-10", "2026-11-11", "2026-11-13", "2026-11-01"]
}
```

WhatsApp import rules:
- Strip the `[DD/MM/YYYY, HH:MM:SS] Sender Name:` prefix from each line.
- Skip lines containing `<Media omitted>` or `This message was deleted`.
- Treat each `Lulu Juicer |` block as one slip.
- Skip dates already in `daily_slips` (do not overwrite confirmed data).

---

## Reports

### `GET /api/reports/month`

Monthly summary using the profit formula from the brief.

**Query params:** `month=2026-11`

**Response 200:**
```json
{
  "month": "2026-11",
  "days_with_data": 20,
  "days_missing": ["2026-11-21", "2026-11-22"],
  "sales": {
    "shop": 69715,
    "keeta": 791,
    "talabat": 2014,
    "total": 72520,
    "unlabeled": 414
  },
  "cash": 29605,
  "card": 40112,
  "costs": {
    "cash_counter": 29605,
    "online_purchases": 9759,
    "fixed": 20112,
    "salary_remaining": 20300,
    "delivery_commission": 0
  },
  "profit_estimate": -7256,
  "is_partial_month": true,
  "data_quality": {
    "needs_review_days": 4,
    "approved_days": 0,
    "ok_days": 16,
    "unlabeled_total": 414,
    "note": "Profit estimate uses 20 of 30 days of sales against full month fixed costs. Treat with caution."
  }
}
```

**Profit formula used:**
```
profit = total_sales
       - cash_counter_costs
       - online_purchases
       - fixed_costs
       - salary_remaining
       - delivery_commission
```

Where `salary_remaining = MAX(0, monthly_salary_total - salary_taken_from_counter)`.

**Double-counting guard:** Salary taken from the counter is already in `cash_counter_costs` (it's part of `expense_items`). `salary_remaining` only covers what has NOT been paid from the counter. These two never overlap.

---

## Master Data (CRUD)

Standard REST endpoints. All require `admin` role for POST/PUT/DELETE.

### Staff
- `GET /api/staff` → array of staff objects.
- `POST /api/staff` → create staff member.
- `PUT /api/staff/{id}` → update (name, aliases, salary, active status).

### Label Aliases
- `GET /api/aliases` → all aliases.
- `POST /api/aliases` → create alias.
- `PUT /api/aliases/{id}` → update (normalized label, category, supplier, staff).
- `DELETE /api/aliases/{id}` → soft-delete (set confirmed = false).

### Fixed Costs
- `GET /api/fixed-costs?month=2026-11` → costs for a month.
- `PUT /api/fixed-costs` → upsert costs for a month. Body: array of `{ month, type, amount }`.

### Online Purchases
- `GET /api/purchases?from=2026-11-01&to=2026-11-30`
- `POST /api/purchases` → manual entry.
- `DELETE /api/purchases/{id}`

### Settings
- `GET /api/settings` → all key-value settings.
- `PUT /api/settings` → update. Body: `{ "key": "value", ... }`. Unknown keys rejected.

---

## Operations

### `GET /api/health`

Health check. Used by UptimeRobot (every 5 minutes). No authentication required.

**Response 200:**
```json
{
  "ok": true,
  "db": true,
  "telegram_webhook_registered": true,
  "queue_pending": 0,
  "queue_stuck": 0,
  "last_message_at": "2026-11-23T10:30:00Z",
  "last_message_ago_minutes": 5
}
```

**Response 200** (but degraded):
```json
{
  "ok": false,
  "db": false,
  "error": "Database connection failed"
}
```

Always returns HTTP 200 (even on degraded state) so UptimeRobot can distinguish "app is up but DB is down" from "app is completely down".

---

### `POST /api/jobs/reprocess`

Re-runs the pipeline for messages stuck in `received` or `processing`. Called by cron-job.org every 5 minutes.

**Header required:** `Authorization: Bearer <CRON_SECRET>`

**Response 200:**
```json
{ "reprocessed": 2, "failed": 0 }
```

---

### `POST /api/jobs/daily-check`

Checks for missing slips and sends reminders. Called at 11 PM Qatar time (20:00 UTC) by cron-job.org.

**Header required:** `Authorization: Bearer <CRON_SECRET>`

**Response 200:**
```json
{ "date": "2026-11-23", "slip_exists": false, "reminder_sent": true }
```

---

### `POST /api/jobs/backup`

Exports all tables as CSV for download. Called weekly by cron-job.org.

**Header required:** `Authorization: Bearer <CRON_SECRET>`

**Response 200:**
```json
{ "download_url": "https://...", "expires_at": "2026-11-30T00:00:00Z" }
```

---

### `POST /api/messages/{id}/reparse`

Re-parses one specific raw message with the current rules. Useful after updating aliases.

**Requires:** `admin` role.

**Response 200:** Updated day object.

---

## Bot Commands (Telegram)

The bot listens for these `/commands` in the group chat:

| Command | Response |
|---|---|
| `/today` | `📊 23 Nov: Shop 1,040 · Keeta 50 · Talabat 30 · Total 1,120` |
| `/missing` | `📅 Missing slips: 21 Nov, 22 Nov` or `✅ All days this month have slips` |
| `/help` | Sends the message template (see OWNER_GUIDE.md) |
