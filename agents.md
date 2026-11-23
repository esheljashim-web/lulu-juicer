# agents.md: Lulu Juicer Dashboard

Read this file and `CORE_PHILOSOPHY.md` first. Then read `docs/lulu-juicer-dashboard-brief.md` (business rules) and `docs/lulu-juicer-api-and-reliability-spec.md` (how the system behaves) in full before writing code.

## Core Philosophy: Make the Numbers Felt
- **Records → Understanding → Decision:** Most business owners do not lack data; they lack a view of their data they can understand at a glance, feel, and act on.
- A picture or UI must provide comparison, context, and a clear next step. Avoid cognitive overload and walls of text. See full background in `CORE_PHILOSOPHY.md`.

## What this is
A free dashboard for a small cafeteria / juice shop in Qatar (currency QAR). The owner is unorganised and sends a daily text slip (sales, cash expenses, card/ATM, Keeta, Talabat). He sends it to a Telegram bot; the slip must appear in the app automatically.

## Golden rules
1. **Never reject, always save, then flag.** Bad or unreadable input must never cause an error for the owner. Save the raw message first, flag the day as `needs_review`, reply "Saved, will check".
2. **Never silently correct a number.** Show the difference and let a human approve.
3. **Code does the arithmetic and validation, never the AI.**
4. **AI is optional.** With `AI_ENABLED=false` the app must still parse all fixture slips.
5. **Do not invent business rules.** Unknown items go into `docs/OPEN_QUESTIONS.md`.
6. **The webhook returns 200 for every valid update** (401 only for a wrong secret).
7. Keep this file and `CHANGELOG.md` updated whenever a rule or schema changes.

## Confirmed business rules (short)
- ATM = customer card payments. Cash expenses are paid from the counter and no cash is left at the end of the day, so cash sales = daily expenses total.
- Total on bill = shop sales = cash + card. Keeta and Talabat are extra. Total sales = Total on bill + Keeta + Talabat.
- `Keeta - blank` = no sales that day. A missing Keeta/Talabat line = treat as 0 but keep status `missing`.
- Rawabi, Firdous, Emdadco = ingredients. Royal Pack, Sulthan = packaging. PT = petrol (car and bike). Sadia and fruit/veg are paid online (not on the slip).
- Staff sometimes take salary from the counter (it appears as "<name> salary - N" in daily expenses). Mijan and Meezan are the same person. Do not double count it with the monthly salary total.
- Fixed monthly costs: shop rent 8,712, room rent 4,600, electricity 4,200, phone 1,100, sponsor fee 1,500.
- Unlabeled amount: still an open question. No rule. Show as its own line and flag the day.

## Stack (all free)
Next.js (TypeScript) on Vercel Hobby, free Postgres (Supabase or Neon), Telegram Bot API, cron-job.org for schedules, UptimeRobot for uptime, Gemini free tier as an optional AI fallback. Keep the app portable (plain Postgres, no Vercel-only features). Vercel Hobby is for non-commercial use, so the owner of the project must decide this before launch.

## Parser (hybrid)
Rules first. AI only for photos, voice, and slips the rules cannot read. AI results are always `needs_review` until approved. Approved AI labels become aliases. See spec section 15.

## Conventions
- TypeScript everywhere. Tests with Vitest.
- Money as integers (QAR).
- Dates `YYYY-MM-DD` in the database; slips use `DD Mon YYYY`.
- Secrets only in environment variables, never in code or logs.
- Write own logs to the `app_logs` table (Vercel Hobby keeps runtime logs for only 1 hour).

## Fixtures (use these for tests)
- `seed/raw_slips_nov2026.jsonl`: the 20 real slips with expected parsed values and flags.
- `seed/raw_other_messages_nov2026.txt`: rent, staff list, fruits, Sadia messages.
- `seed/daily_slips_nov2026.csv`, `seed/expense_items_nov2026.csv`: parsed values.

## Build order
1. Parser + Vitest tests against the 20 fixture slips (AI off).
2. Database schema from the parser's output shape; seed import.
3. Review screen + paste box.
4. Month overview and expenses views.
5. Telegram webhook, allow-list, bot replies, live updates.
6. Salaries, delivery apps, fixed costs, online purchases.
7. WhatsApp zip import (strip the `[date, time] sender:` prefix, skip "omitted" media lines, handle nested messages).
8. AI fallback (photo, voice), shadow mode.

## Documentation to create and keep updated
`docs/API.md` (and `openapi.yaml`), `docs/TELEGRAM_SETUP.md`, `docs/PIPELINE.md`, `docs/DATA_DICTIONARY.md`, `docs/RUNBOOK.md`, `docs/OWNER_GUIDE.md`, `docs/OPEN_QUESTIONS.md`, `CHANGELOG.md`.

## Open questions (waiting on the owner)
Unlabeled amount meaning; what Bakery, Baladna, Bread, Store, Family, Mayonnaise, Chips supply or are; Keeta/Talabat commission and payout timing; who sends the slip and when; what he most wants to see first; card machine fees or delays; how the remaining salaries are paid.
