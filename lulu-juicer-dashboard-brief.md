# Lulu Juicer Dashboard: Build Brief for Gemini / Antigravity

Currency: QAR. Location: Qatar. Business: small cafeteria / juice shop ("Lulu Juicer").
Owner sends daily slips as plain text. The shop is informal and unorganised, so the system must be forgiving and must flag problems instead of failing or silently "fixing" numbers.

Attached seed data (real, November 2026, 20 days): `daily_slips_nov2026.csv`, `expense_items_nov2026.csv` (parsed values), `raw_slips_nov2026.jsonl` (the 20 original slip messages with the expected parsed result for each, use this for parser tests) and `raw_other_messages_nov2026.txt` (rent, salary list, fruit and Sadia messages).

---

## 0. Rules for the agent

1. Do not invent business rules. If a rule is not in this brief, put it in `OPEN_QUESTIONS.md` and ask.
2. Never silently correct a number. If totals do not match, save the entry as `needs_review` and show it on the Review screen.
3. Always keep the original raw message. Every parsed row must link back to its raw message so it can be re-parsed later.
4. Keep `agents.md` (see section 9) updated whenever a rule changes.
5. Build in the order in section 10. Do not start the dashboard UI before the parser passes the tests on the seed data.

---

## 1. Goal

A dashboard for the shop owner that answers, from the slips he already sends:
- How much did we sell each day (shop + delivery apps)?
- Cash vs card split?
- Where does the money go (expenses by category and supplier)?
- Are we making a profit this month after rent, salaries and online purchases?
- Which days have wrong or missing data?

Data should arrive automatically: he sends the slip to a **Telegram bot**, and it appears in the app with no manual typing.

---

## 2. Money flow: confirmed definitions

Confirmed by the owner:

| Item | Meaning |
|---|---|
| **ATM** | Customer payments by card. |
| **Expenses (daily slip)** | Paid from the cash counter. Cash is not left over at end of day; all cash goes to these expenses. |
| **Cash sales** | = daily expenses total (because all cash taken goes out as expenses). |
| **Card sales** | = Total ATM. |
| **Total on bill** | = Shop sales = Cash sales + Card sales. |
| **Keeta, Talabat** | Delivery apps. **Extra**, not included in Total on bill. |
| **Keeta "blank"** | No Keeta sales that day. |
| **Total sales** | = Total on bill + Keeta + Talabat. |
| **Salary from counter** | Staff sometimes take salary (full or part) from the cash counter. It appears as a daily expense line like "Mijan salary – 500". It counts as a normal cash expense AND as a payment toward that person's monthly salary. |

Validation identity for every slip: `Total on bill = Total expenses + Total ATM` (see section 6 for tolerance and flags).

### Costs that are NOT on the daily slip

| Cost | Amount / frequency | How paid |
|---|---|---|
| Shop rent | 8,712 / month | separate |
| Room rent | 4,600 / month | separate |
| Electricity (Kahrama) | 4,200 / month | separate |
| Phone | 1,100 / month | separate |
| Sponsor fee | 1,500 / month | separate |
| **Fixed total** | **20,112 / month** | |
| Staff salaries | 23,000 / month for 12 staff (list in appendix A) | partly from counter, rest other ways |
| Sadia (chicken supplier) | about every 2 weeks | online payment |
| Fruits and veg | about weekly | online payment |

### Monthly profit formula (avoid double counting)

```
Total sales        = sum(total_on_bill) + sum(keeta) + sum(talabat)
Cash-counter costs = sum(daily expenses)            # includes salary taken from counter, fuel, repairs etc.
Online purchases   = Sadia + fruits/veg
Fixed costs        = rent + room rent + electricity + phone + sponsor fee
Salary remaining   = monthly salary due - salary already taken from counter   (never below 0 per person)
Delivery commission= Keeta/Talabat commission (UNKNOWN, see open questions; leave as a setting, default 0)

Profit = Total sales - Cash-counter costs - Online purchases - Fixed costs - Salary remaining - Delivery commission
```

Do not count the 23,000 salary and the salary lines inside daily expenses separately. The counter portion is already in cash-counter costs.

---

## 3. Input formats

### 3.1 Daily slip (main message, one per day)

Real example (the owner's format, most days):

```
Lulu Juicer | 02 Nov 2026
Expenses (QAR)
Rawabi – 835
Store – 15
Firdous – 562
PT – 16
Total expenses – 1,428

ATM (QAR)
184
1,041
547
Total ATM – 1,772

Total on bill – QAR 3,200
Keeta – 127
Talabat – 34
```

Variations seen in the real data (parser must handle all):
- ATM as a single line: `ATM – QAR 1,829` (no individual entries).
- Expense total written as `Expense total on slip – 1,977`, ATM as `ATM total on slip – 1,670`.
- ATM with `Subtotal – 1,649` plus `Additional ATM entry – 77`, then `Total ATM – 1,726`.
- Optional lines after the bill total: `Keeta – N`, `Talabat – N`, `Keeta – blank`, `Unlabeled amount – N`, `Check: ...` notes.
- Keeta and/or Talabat line may be missing entirely on some days.
- Numbers use thousands commas (`1,041`). Dash may be `–`, `-` or `:`. Labels may have typos (`Garmet`, `novmber`).
- Labels with notes in brackets: `Salary (name unclear) – 400`, `Emdadco (name unclear) – 300`.

### 3.2 Other message types in the same group

| Type | Example | Treat as |
|---|---|---|
| Monthly rent block | `Rent -8712 qar / Room rent - 4600 / Kahrama- 4200 (electricity) / Phone - 1100` | fixed costs for that month |
| Salary list | `Lulu Juicer \| Staff Salary List (QAR)` with 12 numbered names | staff master list (appendix A) |
| Fruits | `14 nov fruits 1930 qar`, `07 novemever Fruits n veg - 2032` | online purchase, category Fruits & Veg |
| Sadia | `01 nov Sadia - 2289` | online purchase, supplier Sadia (chicken) |
| Voice notes (.opus) | | transcribe, then parse as text; always send to Review |
| Photos of bills | | OCR/vision parse; always send to Review |

Free-text messages have no fixed format. Use an LLM extraction step with a strict JSON schema, and always send these to Review until trusted.

---

## 4. Ingestion

### 4.1 Primary: Telegram bot (automatic)

WhatsApp does not allow apps to read group messages (and unofficial tools can get the number banned), so the owner should send slips to a **Telegram group or bot** instead.

Flow:
1. Telegram webhook receives the message (text, photo or voice).
2. Check the sender's Telegram user ID against an allow-list. Ignore everyone else.
3. Save the raw message (id, sender, timestamp, text/file).
4. Parse (section 5), validate (section 6).
5. Bot replies in the chat:
   - ok: `✅ 21 Nov saved. Shop 3,560 | Keeta 65 | Talabat 124`
   - problem: `⚠️ 13 Nov: bill 3,057 but cash + card = 3,066 (difference -9). Saved for review.`
6. Re-sending the same date updates that day (no duplicates). Telegram message edits update the entry.

### 4.2 Fallbacks

- **Paste box** in the app: paste a copied WhatsApp slip, preview what was understood, press Confirm.
- **Import chat export**: upload a WhatsApp "Export chat" zip, import all days at once, skip dates already saved.
- **Manual entry form** for one day, as the long-term simple option for the owner.

---

## 5. Parser

1. Rule-based parser first (regex on the slip format above). It should handle every variation in 3.1.
2. If a message does not match, fall back to an LLM with a strict JSON schema, then mark `needs_review`.
3. Normalise labels with a mapping table (`label_aliases`): typos and case-insensitive. Unknown labels get category `Uncategorised` and appear on Review.
4. Parse amounts: strip commas, accept `QAR`, spaces and en/em dashes.
5. Date: `DD Mon YYYY` is the main format; also accept `07 novemever`, `14 nov` (assume the current month/year of the message timestamp and flag).

---

## 6. Validation and Review queue

For each day compute:
- `sum_items` vs stated `Total expenses`
- `sum_atm_entries` vs stated `Total ATM`
- `bill` vs `expenses + ATM`

Flag levels:
- **OK**: exact match.
- **Minor**: difference of 1 to 10 QAR.
- **Needs review**: difference over 10, missing totals, unreadable lines, unknown labels, or `Unlabeled amount`.

Known flags in the seed data (use as test cases):

| Date | Issue |
|---|---|
| 01 Nov | Items add to 2,001 but slip says 1,977 (the PT 24 line is not in the slip total). ATM entries add to 1,676 but total says 1,670. Bill 3,647 = 1,977 + 1,670, but items give 3,677. |
| 10 Nov | Bill 3,775 vs 1,474 + 2,302 = 3,776 (−1). |
| 11 Nov | Bill 3,348 vs 1,511 + 1,829 = 3,340 (+8). |
| 13 Nov | Bill 3,057 vs 1,340 + 1,726 = 3,066 (−9). |
| 03, 09, 10, 11 Nov | `Unlabeled amount` of 73, 16, 226, 99 (meaning unknown; ask the owner). |
| 05, 18, 20 Nov | `Keeta – blank` (treat as 0, sales = none that day). |
| various | Keeta or Talabat line missing: treat as 0 but mark `source=missing` (different from `blank`). |
| 01 Nov | `Salary (name unclear) – 400`: cannot be matched to a staff member. |

Also a **Missing day** alert: a date with no slip at all.

Review screen: shows the raw message next to the parsed values, lets the user edit, pick a category or staff member, and Approve. All edits are logged (who, when, old value, new value).

---

## 7. Categories

**Confirmed by the owner**

| Label | Category |
|---|---|
| Rawabi, Firdous, Emdadco | Ingredients (food supplies) |
| Royal Pack, Sulthan (also written "Sulthan Plastic") | Packaging |
| PT | Fuel (petrol for car and bike) |
| `<name> salary` | Salary (match to staff member) |
| Sadia | Chicken supplier (paid online) |
| Fruits, Fruits n veg | Fruits & Veg (paid online) |
| Keeta, Talabat | Delivery apps (sales, not expenses) |

**Not yet confirmed. Keep as raw labels, do not guess; ask the owner:**
Bakery, Bread, Baladna, Store, Family, Mayonnaise, Chips, Cheese, Beef keema, Samosa, Zinger, Garmet, Tissue, Water, Bike repair, A/C repair, Panasonic blender, Marwa.

Suggested provisional grouping for the UI only (mark clearly as "suggested, unconfirmed"): food items (Bakery, Bread, Baladna, Mayonnaise, Chips, Cheese, Beef keema, Samosa, Zinger, Water), repairs (Bike repair, A/C repair), equipment (Panasonic blender), supplies (Tissue, Garmet), other (Store, Family, Marwa).

Categories and aliases must be editable in the app (a Settings table), not hard-coded.

---

## 8. Data model (suggested)

- `raw_messages`: id, source (telegram / paste / import), sender, received_at, text, file_url, parse_status
- `daily_slips`: date (unique), cash_expenses_stated, cash_expenses_calc, card_atm_stated, card_atm_calc, total_on_bill, keeta, talabat, unlabeled, keeta_status (value / blank / missing), talabat_status, status (ok / minor / needs_review / approved), raw_message_id
- `expense_items`: id, date, label_raw, label_normalized, category, supplier, staff_id (nullable), amount, raw_message_id
- `card_entries`: id, date, amount
- `purchases_online`: date, supplier (Sadia / Fruits & Veg), amount, raw_message_id
- `fixed_costs`: month, type (shop_rent, room_rent, electricity, phone, sponsor_fee), amount
- `staff`: id, name, aliases (e.g. Meezan = Mijan), monthly_salary, active
- `label_aliases`: label_raw, label_normalized, category, supplier
- `audit_log`: table, row id, field, old, new, by, at
- `settings`: delivery commission rates, tolerance values, allowed Telegram user IDs

Keep money as integers (QAR) unless fractions appear.

---

## 9. Dashboard views

1. **Today / Latest day**: shop sales, cash vs card, Keeta, Talabat, total sales, expense list.
2. **Month overview**: total sales, average per day, best and worst day, cash vs card %, delivery share %, profit estimate using the formula in section 2, daily sales line chart.
3. **Expenses**: by category, by supplier (top suppliers), trend per supplier, fuel total, repairs total.
4. **Salaries**: per staff: salary due, taken from counter, balance.
5. **Delivery apps**: Keeta and Talabat per day and total.
6. **Review queue**: flags from section 6 with count badge.
7. **Fixed costs and online purchases**: month list, editable.
8. **Settings**: staff, categories, aliases, allowed Telegram users, tolerances, commission rates.

Mobile-first (the owner uses a phone). Show QAR everywhere. Show data quality status on every chart (e.g. "3 days need review").

---

## 10. Build order

1. Database + seed import of the two CSVs.
2. Parser + unit tests using the real slips (cover every variation in 3.1 and every flag in section 6).
3. Review screen + paste box.
4. Month overview + expenses views.
5. Telegram bot with allow-list and replies.
6. Salaries, delivery, fixed costs and online purchases.
7. WhatsApp chat-export import.
8. Photo and voice parsing.

---

## 11. Documentation to produce (and keep updated)

- `agents.md`: purpose, the definitions in section 2, the validation rules, the do/don't list in section 0, and file map. Every agent reads this first.
- `DATA_DICTIONARY.md`: every table and field, with examples.
- `CATEGORIES.md`: confirmed vs unconfirmed labels (section 7).
- `MESSAGE_TEMPLATE.md`: a one-page template for the owner (same order, same labels, staff name on every salary line, always write the date as `DD Mon YYYY`).
- `OPEN_QUESTIONS.md`: section 12, updated as answers arrive.
- `CHANGELOG.md`: one line per change to rules or schema.

---

## 12. Open questions (waiting on the owner)

1. What is "Unlabeled amount" (73, 16, 226, 99)? Is it a third delivery app or another income?
2. What do Bakery and Baladna supply (and Bread, Store, Family, Mayonnaise, Chips)?
3. What are the "Family" and "Store" entries (they appear almost every day)?
4. What commission do Keeta and Talabat keep, and when do they pay? Are the amounts on the slip before or after commission?
5. Who sends the slip each day, and at what time?
6. What does he most want to see first?
7. Are there card machine fees or delays before card money reaches the bank?
8. How are the rest of the salaries paid (bank, cash, other), and is it recorded anywhere?

---

## Appendix A: Staff master list (monthly salary, QAR)

Janid 3,000 · Shamnad 2,200 · Asarudheen 1,800 · Nasseer 2,000 · Saddam 1,500 · Sameer 1,600 · Afnas 1,600 · Farbi 1,700 · Basheerka 2,700 (also written "Basheer") · Shafnas 1,100 · Meezan 1,800 (also written "Mijan", same person) · Ishaq 2,000.
**Total 23,000.**

Seed check: in November, Meezan/Mijan took exactly 1,800 from the counter (500 + 400 + 200 + 500 + 200), which equals his full salary.

## Appendix B: November 1 to 20 summary (for testing the dashboard)

| Measure | Value |
|---|---|
| Days with slips | 20 |
| Total on bill (shop sales) | 69,715 (average 3,486 per day) |
| Cash (expenses) | 29,605 (about 42.5%) |
| Card (ATM) | 40,112 (about 57.5%) |
| Keeta | 791 |
| Talabat | 2,014 |
| Unlabeled | 414 |
| Total sales (shop + Keeta + Talabat) | 72,520, excluding the unlabeled 414 |
| Largest expense label | Rawabi 12,221 over 20 days |
| Ingredients (Rawabi 12,221 + Firdous 1,655 + Emdadco 300) | 14,176 (Rawabi + Firdous alone: 13,876) |
| Fuel (PT) | 377 over 15 days |
| Online: Fruits and veg | 5,747 (1,785 + 2,032 + 1,930, on 1, 7 and 14 Nov) |
| Online: Sadia | 4,012 (2,289 + 1,723, on 1 and 14 Nov) |

Using the totals written on the slip, `Total on bill = expenses + card` matches on 17 of 20 days (10, 11 and 13 Nov do not). 1 Nov matches on the written totals but its individual items do not add up. All four are listed in section 6.
