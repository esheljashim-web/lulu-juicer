# Message Processing Pipeline — Lulu Juicer Dashboard

> Every message the owner sends travels through this exact pipeline. Understanding it is essential before writing any code or debugging any issue.

---

## Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  OWNER'S TELEGRAM (phone)                                       │
│  Sends: text slip / photo / voice note / edited message         │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTPS POST
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/telegram/webhook                                     │
│                                                                 │
│  Step 1 ── Verify secret header                                 │
│            X-Telegram-Bot-Api-Secret-Token must match env var   │
│            FAIL → 401, nothing else happens, done               │
│                                                                 │
│  Step 2 ── Deduplicate by update_id                             │
│            INSERT INTO telegram_updates(update_id) ON CONFLICT  │
│            CONFLICT → 200, stop (Telegram retry already handled)│
│                                                                 │
│  Step 3 ── Allow-list check                                     │
│            message.from.id must be in ALLOWED_USER_IDS          │
│            NOT ALLOWED → 200, log event=ignored, stop           │
│                                                                 │
│  Step 4 ── SAVE RAW MESSAGE ← most important step               │
│            INSERT INTO raw_messages (status = received)         │
│            This happens BEFORE anything that can fail.          │
│                                                                 │
│  Step 5 ── Return 200 immediately                               │
│            Must complete within ~1 second total                 │
│            Telegram considers anything > 60s as a timeout       │
│            and will retry the same update                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Handed off to background job
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKGROUND JOB (waitUntil / queue)                             │
│  Everything from here is wrapped in try/catch.                  │
│  Any crash → status = needs_review, error stored internally.   │
│                                                                 │
│  Step 6 ── Classify the message                                 │
│            • "Lulu Juicer |" header → kind = slip               │
│            • "Rent", "Kahrama", "Room rent" → kind = fixed_cost │
│            • "Staff Salary List" → kind = salary_list           │
│            • "fruit" / "veg" → kind = fruits_purchase           │
│            • "Sadia" → kind = sadia_purchase                    │
│            • photo attachment → kind = photo                    │
│            • voice attachment → kind = voice                    │
│            • anything else → kind = other                       │
│                                                                 │
│  Step 7 ── Parse                                                │
│            Rule-based parser first (handles all 20 fixture slips│
│            with AI_ENABLED=false)                               │
│            If rules cannot read it → AI fallback (Gemini)       │
│            If AI fails / disabled → raw-only, needs_review      │
│            Parser NEVER throws. Always returns a result object. │
│                                                                 │
│  Step 8 ── Validate                                             │
│            • sum(expense_items) vs stated total_expenses        │
│            • sum(atm_entries) vs stated total_atm               │
│            • total_on_bill vs (total_expenses + total_atm)      │
│            • Unlabeled amount present?                          │
│            • Unknown labels?                                    │
│            Assign flag: ok / minor (≤10 QAR diff) / needs_review│
│                                                                 │
│  Step 9 ── Database upsert (single transaction)                 │
│            BEGIN TRANSACTION                                    │
│              • If daily_slips row exists for this date:         │
│                  INSERT INTO daily_slip_versions (snapshot)     │
│                  UPDATE daily_slips (new values)                │
│              • If new date:                                     │
│                  INSERT INTO daily_slips                        │
│              • DELETE + INSERT expense_items for the date       │
│              • DELETE + INSERT card_entries for the date        │
│              • UPDATE raw_messages status = parsed              │
│            COMMIT                                               │
│            On any DB error → ROLLBACK, status = needs_review    │
│                                                                 │
│  Step 10 ── Write audit row                                     │
│             INSERT INTO audit_log (what changed, who, when)     │
│                                                                 │
│  Step 11 ── Send bot reply                                      │
│             Build reply text from flag level (see REPLIES.md)   │
│             sendMessage with reply_to_message_id                │
│             Failure to send is LOGGED ONLY — data is safe       │
│                                                                 │
│  Step 12 ── Publish live update                                 │
│             Supabase Realtime OR set a flag the dashboard polls │
│             Dashboard shows toast: "23 Nov updated"             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  RETRY JOB  (cron-job.org, every 5 minutes)                     │
│  POST /api/jobs/reprocess  (Bearer CRON_SECRET required)        │
│                                                                 │
│  Finds raw_messages where:                                      │
│    status IN ('received', 'processing')                         │
│    AND updated_at < NOW() - INTERVAL '2 minutes'                │
│    AND retry_count < 5                                          │
│                                                                 │
│  Re-runs Steps 6–12 for each one.                               │
│  After 5 failures: status = needs_review, alert admin chat.     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Raw Message Status Lifecycle

```
                                   ┌──────────┐
                      (not allowed)│  ignored │
                                   └──────────┘
                                        ▲
                                        │
[Telegram sends] ──► received ──► processing ──► parsed ──► approved
                                        │
                                        └──► needs_review
                                                  │
                                         (human fixes it)
                                                  │
                                                  └──► approved
```

| Status | Meaning |
|---|---|
| `received` | Raw message saved. Background job not started yet. |
| `processing` | Background job is running. |
| `parsed` | Parsed and saved to daily_slips successfully. Flag may be ok / minor. |
| `needs_review` | Arithmetic mismatch, unknown label, unreadable, or internal error. Visible on Review screen. |
| `approved` | Human reviewed and approved on the Review screen. |
| `ignored` | Sender not on allow-list, or unrelated chat. Nothing saved. |

---

## Message Classification Rules

The classifier reads the raw text and sets `kind`. It runs before the parser.

| Keyword / Pattern | kind | Handler |
|---|---|---|
| Text starts with `Lulu Juicer \|` | `slip` | Rule-based slip parser |
| Contains `Rent` AND (`Room rent` OR `Kahrama` OR `Phone`) | `fixed_cost` | Fixed cost parser |
| Contains `Staff Salary List` | `salary_list` | Salary list parser |
| Contains `fruit` or `veg` (case-insensitive) | `fruits_purchase` | Online purchase parser |
| Contains `Sadia` | `sadia_purchase` | Online purchase parser |
| Has `photo` attachment | `photo` | AI vision + Review |
| Has `voice` attachment | `voice` | AI transcribe + parse + Review |
| Anything else | `other` | Save raw, Review |

---

## What Happens When Things Go Wrong

| Failure Point | What Happens | Owner Sees | Data Lost? |
|---|---|---|---|
| Webhook crashes before Step 4 | Telegram retries (up to 48h) | Nothing yet | No — will process on retry |
| Webhook crashes after Step 4 | Raw message is saved, retry job picks it up | Nothing yet | No |
| Parser throws an exception | Caught by try/catch, `needs_review` | No bot reply yet, retry job re-runs it | No |
| Database is down at Step 9 | Transaction rolled back, retry job re-runs | Nothing yet | No |
| Bot reply fails at Step 11 | Error logged, pipeline continues | No reply, but data is saved | No |
| Retry job: 5 failures on same message | `needs_review`, admin alert sent | No bot reply | No — raw message still exists |
| App completely down for hours | Telegram queues updates (up to 48h). On restart, all queued updates arrive at once and dedupe handles them. | Nothing | No |

> **The critical guarantee:** A message from an allowed sender is **never lost** because it is always saved in Step 4 before anything that can fail.

---

## Date Handling Rules

The slip's own date header is **always** the source of truth — not the timestamp Telegram sends.

| Slip Header | Telegram Message Time | Stored Date |
|---|---|---|
| `Lulu Juicer \| 20 Nov 2026` | 23 Nov 2026, 00:30 (sent after midnight) | 2026-11-20 |
| `Lulu Juicer \| 23 Nov 2026` | 23 Nov 2026, 14:00 | 2026-11-23 |
| No date in slip | (any time) | Use Telegram message date, flag as `date_assumed` |

Fuzzy date parsing (from real slip variations):
- `01 Nov 2026` → `2026-11-01`
- `01 -novmber` → `2026-11-01` (typo `novmber` matched by first 3 chars `nov`)
- `07 novemever` → `2026-11-07` (typo matched by first 3 chars `nov`)
- `14 nov` → `2026-11-14` (year assumed from message timestamp)

---

## Idempotency: Sending the Same Slip Twice

The owner may resend a corrected slip for the same date. This is handled safely:

1. A new `update_id` from Telegram → not a dedupe hit.
2. The parser reads the date header: `20 Nov 2026`.
3. `daily_slips` already has a row for `2026-11-20`.
4. The old row is snapshot-copied to `daily_slip_versions`.
5. `daily_slips` is updated with the new values.
6. Bot replies: `🔄 20 Nov updated.`
7. If the previous status was `approved`, it reverts to `needs_review` so a human can confirm the new values.

---

## Daily Check Job (11 PM Qatar Time, UTC+3)

Triggered by cron-job.org at `20:00 UTC` daily:

```
POST /api/jobs/daily-check
Authorization: Bearer <CRON_SECRET>
```

Logic:
1. Check if a slip exists for today's date (Qatar timezone = UTC+3).
2. If no slip found: send to the owner's group: `⏰ No slip for 23 Nov yet.`
3. Check for any raw_messages stuck in `processing` for over 10 minutes → alert admin.
4. Log the check to `app_logs`.
