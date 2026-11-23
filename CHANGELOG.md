# Changelog — Lulu Juicer Dashboard

One line per change to rules, schema, or confirmed business information.
Format: `YYYY-MM-DD | type | description`
Types: `rule`, `schema`, `answered`, `bug`, `deploy`

---

| Date | Type | Description |
|---|---|---|
| 2026-11-23 | rule | Initial business rules confirmed: ATM = card sales, cash = expenses total, Total on bill = cash + card, Keeta/Talabat are extra. |
| 2026-11-23 | rule | Mijan and Meezan confirmed as the same person. Alias added. |
| 2026-11-23 | rule | Rawabi, Firdous, Emdadco = Ingredients. Royal Pack, Sulthan = Packaging. PT = Fuel. Confirmed by brief. |
| 2026-11-23 | rule | Sadia and Fruit/Veg are online purchases, not counter cash expenses. |
| 2026-11-23 | rule | Fixed monthly costs confirmed: shop rent 8,712; room rent 4,600; electricity (Kahrama) 4,200; phone 1,100; sponsor fee 1,500. Total 20,112 QAR/month. |
| 2026-11-23 | rule | Staff salary total confirmed: 12 staff, 23,000 QAR/month. See staff table seed data. |
| 2026-11-23 | rule | Unlabeled amount: no rule yet. Show as own line, flag day needs_review. See OPEN_QUESTIONS #1. |
| 2026-11-23 | schema | Initial schema designed: raw_messages, telegram_updates, daily_slips, daily_slip_versions, expense_items, card_entries, purchases_online, fixed_costs, staff, label_aliases, audit_log, settings, app_logs. |
| 2026-11-23 | rule | CORE_PHILOSOPHY.md added: Records → Understanding → Decision principle applied to all UI and reporting. |
