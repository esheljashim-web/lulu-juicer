# Data Dictionary — Lulu Juicer Dashboard

> Every table, every column, every enum value. Read this before writing any database query or migration.

**Conventions:**
- All money values are **integers in QAR** (Qatar Riyal). No decimals. If a fraction ever appears, multiply by 100 and store as fils. Flag in `OPEN_QUESTIONS.md`.
- All dates are `YYYY-MM-DD` (ISO 8601) in the database. Never store a date as a string in another format.
- All timestamps are `TIMESTAMPTZ` (UTC). The app displays them in Qatar time (UTC+3).
- Never delete any row. Use status columns and version tables instead.

---

## Table: `telegram_updates`

Purpose: Deduplication. Prevents the same Telegram update from being processed twice.

| Column | Type | Notes |
|---|---|---|
| `update_id` | `BIGINT PRIMARY KEY` | Telegram's globally unique update ID. Conflicts on INSERT = already seen. |
| `received_at` | `TIMESTAMPTZ` | When the webhook received it. |

---

## Table: `raw_messages`

Purpose: Permanent archive of every message received. The source of truth for all parsed data. Never delete.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | Generated on INSERT. |
| `telegram_update_id` | `BIGINT` | References `telegram_updates.update_id`. Null for paste/import sources. |
| `telegram_message_id` | `BIGINT` | Telegram's message_id within the chat. Used as natural key with `chat_id` for edits. |
| `telegram_chat_id` | `BIGINT` | The chat the message came from. |
| `source` | `ENUM` | `telegram`, `paste`, `whatsapp_import`, `manual`. |
| `sender_telegram_id` | `BIGINT` | Telegram user ID of sender. Null for paste/import. |
| `sender_name` | `TEXT` | Display name at time of sending (denormalized for logs). |
| `received_at` | `TIMESTAMPTZ` | Exact time the webhook received it (UTC). |
| `text` | `TEXT` | Full raw text of the message. Max 4,096 chars (Telegram limit). |
| `file_url` | `TEXT` | URL to downloaded file (photo or voice). Null for text messages. |
| `file_type` | `ENUM` | `photo`, `voice`, `document`, null. |
| `kind` | `ENUM` | `slip`, `fixed_cost`, `salary_list`, `fruits_purchase`, `sadia_purchase`, `photo`, `voice`, `other`. Set after classification. |
| `status` | `ENUM` | `received`, `processing`, `parsed`, `needs_review`, `approved`, `ignored`. |
| `retry_count` | `INTEGER` | Default 0. Incremented by retry job on each failure. Max 5. |
| `internal_error` | `TEXT` | Stack trace or error message from last failed attempt. Never shown to owner. |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated on every status change. |

**Index:** `(telegram_chat_id, telegram_message_id)` — for edited_message upserts.
**Index:** `(status, updated_at)` — for the retry job query.

---

## Table: `daily_slips`

Purpose: One row per business day. The live, current version of that day's data. Authoritative source for the dashboard.

| Column | Type | Notes |
|---|---|---|
| `date` | `DATE PRIMARY KEY` | The business date in Qatar timezone. `YYYY-MM-DD`. |
| `raw_message_id` | `UUID` | References `raw_messages.id` — the message that produced the current version. |
| `cash_expenses_stated` | `INTEGER` | The total expenses number written on the slip. May differ from sum of items. |
| `cash_expenses_calc` | `INTEGER` | Sum of all `expense_items.amount` for this date. Computed by the app, never trusted from slip. |
| `card_atm_stated` | `INTEGER` | The ATM total written on the slip. May differ from sum of card_entries. |
| `card_atm_calc` | `INTEGER` | Sum of all `card_entries.amount` for this date. |
| `total_on_bill` | `INTEGER` | Shop sales. Written on the slip. Used as primary value for revenue. |
| `total_on_bill_source` | `ENUM` | `stated`, `calc_expenses_plus_atm`, `calc_items_plus_entries`. Tracks which fallback was used. |
| `keeta` | `INTEGER` | Keeta delivery sales. 0 if blank or missing. |
| `keeta_status` | `ENUM` | `value` (amount > 0), `blank` (owner wrote "blank"), `missing` (line not in slip). |
| `talabat` | `INTEGER` | Talabat delivery sales. 0 if blank or missing. |
| `talabat_status` | `ENUM` | `value`, `blank`, `missing`. |
| `unlabeled` | `INTEGER` | The "Unlabeled amount" figure from the slip. 0 if absent. Not added to total sales. |
| `total_sales` | `INTEGER` | Computed: `total_on_bill + keeta + talabat`. Unlabeled excluded until confirmed. |
| `bill_diff` | `INTEGER` | `total_on_bill - (cash_expenses_stated + card_atm_stated)`. 0 means perfect. |
| `items_diff` | `INTEGER` | `cash_expenses_calc - cash_expenses_stated`. 0 means items add up to stated total. |
| `atm_diff` | `INTEGER` | `card_atm_calc - card_atm_stated`. 0 means ATM entries add up. |
| `flag` | `ENUM` | `ok`, `minor`, `needs_review`. See flag rules below. |
| `status` | `ENUM` | `ok`, `minor`, `needs_review`, `approved`. `approved` = human reviewed. |
| `version` | `INTEGER` | Incremented on every update. Used for optimistic locking (PUT /api/days/{date}). |
| `created_at` | `TIMESTAMPTZ` | When this row was first created. |
| `updated_at` | `TIMESTAMPTZ` | When this row was last updated. |

**Flag rules:**
- `ok`: all diffs = 0, no unlabeled, no unknown labels, no missing totals.
- `minor`: any diff is 1 to 10 QAR (absolute value), nothing else wrong.
- `needs_review`: any diff > 10, any unlabeled amount, any unknown label, any unreadable line, any missing stated total.

---

## Table: `daily_slip_versions`

Purpose: Full history. Every time a daily slip is updated, the old version is snapshot here.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `date` | `DATE` | The business date this version relates to. |
| `version` | `INTEGER` | Version number of the daily_slips row at time of snapshot. |
| `snapshot` | `JSONB` | Full copy of the daily_slips row at that version. |
| `replaced_by_message_id` | `UUID` | The raw_message that caused this version to be replaced. |
| `created_at` | `TIMESTAMPTZ` | When this snapshot was saved. |

---

## Table: `expense_items`

Purpose: Individual expense lines from each daily slip.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `date` | `DATE` | References `daily_slips.date`. |
| `raw_message_id` | `UUID` | The source message. |
| `label_raw` | `TEXT` | Exactly as written on the slip. E.g. `Sulthan Plastic`, `Mijan salary`. |
| `label_normalized` | `TEXT` | After alias lookup. E.g. `Sulthan`, `SALARY: Meezan`. |
| `category` | `TEXT` | From `label_aliases.category`. `Uncategorised` if unknown. |
| `supplier` | `TEXT` | Supplier name if applicable. Null otherwise. |
| `staff_id` | `UUID` | References `staff.id` for salary lines. Null for non-salary. |
| `amount` | `INTEGER` | QAR, positive integer. |
| `is_salary` | `BOOLEAN` | True if this line is a staff salary advance from the counter. |
| `position` | `INTEGER` | Line order within the slip, for display purposes. |

**Index:** `(date)` — daily lookups.

---

## Table: `card_entries`

Purpose: Individual ATM / card payment entries within a day's slip.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `date` | `DATE` | References `daily_slips.date`. |
| `raw_message_id` | `UUID` | |
| `amount` | `INTEGER` | QAR. |
| `position` | `INTEGER` | Line order within the slip. |
| `is_subtotal` | `BOOLEAN` | True if this entry was a `Subtotal` line, not an individual transaction. |
| `is_additional` | `BOOLEAN` | True if labeled `Additional ATM entry`. |

---

## Table: `purchases_online`

Purpose: Sadia and fruit/veg purchases paid online (not from the counter cash).

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `date` | `DATE` | Date of purchase (from message, not posting date). |
| `raw_message_id` | `UUID` | |
| `supplier` | `TEXT` | `Sadia`, `Fruits & Veg`. |
| `amount` | `INTEGER` | QAR. |
| `notes` | `TEXT` | Any extra detail from the message. |

---

## Table: `fixed_costs`

Purpose: Monthly overhead costs (rent, electricity, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `month` | `DATE` | First day of the month. E.g. `2026-11-01`. |
| `type` | `ENUM` | `shop_rent`, `room_rent`, `electricity`, `phone`, `sponsor_fee`. |
| `amount` | `INTEGER` | QAR. Defaults from brief: 8712, 4600, 4200, 1100, 1500. Editable in Settings. |
| `source_message_id` | `UUID` | If set from a Telegram message. Null if set manually in Settings. |

**Default values per month (must be seeded on first run):**

| type | amount |
|---|---|
| `shop_rent` | 8,712 |
| `room_rent` | 4,600 |
| `electricity` | 4,200 |
| `phone` | 1,100 |
| `sponsor_fee` | 1,500 |
| **Total** | **20,112** |

---

## Table: `staff`

Purpose: Master list of employees. Used to match salary lines in slips.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `name` | `TEXT` | Canonical name. E.g. `Meezan`. |
| `aliases` | `TEXT[]` | Other spellings. E.g. `{Mijan}`. Used by parser to match salary lines. |
| `monthly_salary` | `INTEGER` | QAR. |
| `active` | `BOOLEAN` | False if no longer employed. |

**Seed data (from brief Appendix A):**

| name | aliases | monthly_salary |
|---|---|---|
| Janid | | 3,000 |
| Shamnad | | 2,200 |
| Asarudheen | | 1,800 |
| Nasseer | | 2,000 |
| Saddam | | 1,500 |
| Sameer | | 1,600 |
| Afnas | | 1,600 |
| Farbi | | 1,700 |
| Basheerka | {Basheer} | 2,700 |
| Shafnas | | 1,100 |
| Meezan | {Mijan} | 1,800 |
| Ishaq | | 2,000 |

Total: 12 staff, QAR 23,000/month.

---

## Table: `label_aliases`

Purpose: Maps raw slip labels to normalized names, categories, suppliers, and staff. This is how the app learns from approved corrections without re-parsing.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `label_raw` | `TEXT UNIQUE` | Lowercase, trimmed. E.g. `sulthan plastic`. |
| `label_normalized` | `TEXT` | Canonical label. E.g. `Sulthan`. |
| `category` | `TEXT` | E.g. `Ingredients`, `Packaging`, `Fuel`, `Salary`, `Uncategorised`. |
| `supplier` | `TEXT` | Null if not a supplier. |
| `staff_id` | `UUID` | References `staff.id` if this is a salary label. |
| `confirmed` | `BOOLEAN` | True = owner confirmed. False = AI suggested, still in Review. |
| `created_by` | `ENUM` | `rule`, `ai`, `human`. |

**Pre-seeded confirmed aliases (from brief):**

| label_raw | label_normalized | category |
|---|---|---|
| rawabi | Rawabi | Ingredients |
| firdous | Firdous | Ingredients |
| emdadco | Emdadco | Ingredients |
| royal pack | Royal Pack | Packaging |
| sulthan | Sulthan | Packaging |
| sulthan plastic | Sulthan | Packaging |
| pt | PT | Fuel |
| keeta | Keeta | Delivery App |
| talabat | Talabat | Delivery App |
| sadia | Sadia | Chicken Supplier |

---

## Table: `audit_log`

Purpose: Immutable record of every human edit. Used for accountability and "who changed what".

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `table_name` | `TEXT` | Which table was changed. |
| `row_id` | `TEXT` | PK of the changed row. |
| `field` | `TEXT` | Column name that changed. |
| `old_value` | `TEXT` | Previous value as text. |
| `new_value` | `TEXT` | New value as text. |
| `changed_by` | `TEXT` | `system`, `owner`, or `admin`. |
| `changed_at` | `TIMESTAMPTZ` | |
| `reason` | `TEXT` | Optional note from the reviewer. |

---

## Table: `settings`

Purpose: Editable configuration values. Avoids hardcoding business parameters.

| Key | Default | Description |
|---|---|---|
| `review_tolerance_minor_qar` | `10` | Diffs ≤ this value → flag `minor`. Above → `needs_review`. |
| `delivery_commission_keeta_pct` | `0` | Keeta commission %. 0 until confirmed by owner. |
| `delivery_commission_talabat_pct` | `0` | Talabat commission %. 0 until confirmed. |
| `ai_enabled` | `true` | Set to `false` to disable all AI calls. App must work fully with `false`. |
| `ai_shadow_mode` | `false` | If true, run AI in background and log diffs but never save AI output. |
| `ai_daily_call_cap` | `50` | Max Gemini API calls per day. Resets at midnight Qatar time. |
| `monthly_salary_total` | `23000` | Cross-check: sum of staff.monthly_salary must equal this. |
| `missing_slip_reminder_time` | `23:00` | Qatar time (UTC+3). Time to send the daily missing-slip reminder. |
| `telegram_allowed_user_ids` | (from env) | Comma-separated. Env var is source of truth; this is a readable copy. |

---

## Table: `app_logs`

Purpose: Structured application logs. Vercel Hobby keeps runtime logs for only 1 hour, so the app writes important events here. Deleted after 30 days.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | |
| `at` | `TIMESTAMPTZ` | |
| `level` | `ENUM` | `info`, `warn`, `error`. |
| `event` | `TEXT` | Machine-readable event name. E.g. `webhook_received`, `parse_complete`, `ai_shadow_diff`, `bot_reply_failed`. |
| `message_id` | `UUID` | References `raw_messages.id` if applicable. |
| `details` | `JSONB` | Structured extra data. Never includes secrets. |
| `duration_ms` | `INTEGER` | For timed events. |

**Key event names:**

| event | When |
|---|---|
| `webhook_received` | Immediately after Step 4 saves the raw message. |
| `dedupe_hit` | Same `update_id` received again. |
| `sender_ignored` | Sender not on allow-list. |
| `classify_complete` | Message classified (kind set). |
| `parse_complete` | Parser finished. Includes flag and diff values. |
| `parse_fallback_ai` | Rules could not parse, AI was called. |
| `ai_shadow_diff` | Shadow mode: AI disagreed with rule parser. |
| `db_upsert_complete` | Day saved to database. |
| `bot_reply_sent` | Bot reply sent successfully. |
| `bot_reply_failed` | Bot reply failed (data was saved; this is non-fatal). |
| `retry_job_run` | Retry job executed. Includes count of messages reprocessed. |
| `queue_stuck_alert` | Message stuck > 10 min; admin alerted. |
| `daily_check_run` | Daily 11pm check executed. |

---

## Computed Values (Never Stored, Always Calculated at Query Time)

| Value | Formula |
|---|---|
| **Salary taken from counter (per person, per month)** | `SUM(expense_items.amount) WHERE staff_id = X AND date BETWEEN month_start AND month_end` |
| **Salary remaining (per person, per month)** | `MAX(0, staff.monthly_salary - salary_taken_from_counter)` |
| **Monthly profit estimate** | `total_sales - cash_counter_costs - online_purchases - fixed_costs - salary_remaining_total - delivery_commission` |
| **Unreconciled cash** | `daily_slips.cash_expenses_stated - SUM(expense_items.amount)` for that date. Can be negative. |
| **Category breakdown** | `SUM(expense_items.amount) GROUP BY category` plus an `Unreconciled` row so it always adds to `cash_expenses_stated`. |
