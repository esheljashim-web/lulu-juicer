# Open Questions — Lulu Juicer Dashboard

> Questions waiting for answers from the owner. Do not guess or invent rules. Leave items here until confirmed.
> When an answer arrives: update this file (mark answered), update AGENTS.md, update DATA_DICTIONARY.md if the schema changes, and add one line to CHANGELOG.md.

---

## Unanswered

| # | Question | Why it matters | First seen |
|---|---|---|---|
| 1 | What is the **"Unlabeled amount"**? (Seen: 73 on Nov 03, 16 on Nov 09, 226 on Nov 10, 99 on Nov 11 — total 414 QAR.) Is it a third delivery platform, a cash tip, a rounding fund, or something else? | Until answered, it cannot be added to total sales or any expense category. It is shown as its own line and the day is flagged `needs_review`. | Nov 03 slip |
| 2 | What does **Bakery** supply? Is it an ingredient supplier, or the owner buying from a bakery shop for resale? | Determines the category: Ingredients vs. Uncategorised. | Nov 01 slip |
| 3 | What does **Baladna** supply? (Baladna is a Qatari dairy brand.) Dairy / drinks ingredients? | Category assignment. | Nov 10 slip |
| 4 | What are **Bread**, **Mayonnaise**, **Chips**, **Cheese**, **Beef keema**, **Samosa**, **Zinger** expenses? Are these ingredients purchased, or staff meals, or items bought for resale? | Category assignment. Very frequent (appear almost every day). | Nov 03 slip |
| 5 | What is **Store** (appears almost every day, small amounts like 10–30 QAR)? A local convenience store run? Supplies? | Category assignment. Appears every day — important to categorize correctly. | Nov 01 slip |
| 6 | What is **Family**? (Appears almost every day, amounts vary 12–220 QAR.) Is it a supplier named "Family", or money given to a family member, or something else? | Category assignment. If it's a personal withdrawal, it should be excluded from business expenses. | Nov 01 slip |
| 7 | What is **Marwa**? (Appeared once: Nov 06, 15 QAR.) A person? A supplier? | Category assignment. | Nov 06 slip |
| 8 | What do **Garmet** and **Tissue** represent? Cleaning supplies? Staff uniform? | Category assignment. | Nov 05 slip |
| 9 | What is **Water** (Nov 08, 215 QAR)? Drinking water delivery for the shop? | Category assignment. | Nov 08 slip |
| 10 | What does **Bike repair** cover — the delivery bike, or the owner's personal bike? | Determines if it's a business expense. | Nov 09 slip |
| 11 | What is **A/C repair** (Nov 17, 260 QAR)? The shop's air conditioning? | Business expense, category: Maintenance/Repairs. Likely confirmed but not official. | Nov 17 slip |
| 12 | What is **Panasonic blender** (Nov 20, 289 QAR)? A kitchen appliance purchase? One-off or recurring? | Category: Equipment. If one-off, should it be depreciated or expensed directly? | Nov 20 slip |
| 13 | The **salary line "Salary (name unclear) – 400"** on Nov 01 — which staff member is this? | Cannot be linked to a person's salary balance without an answer. Currently marked `staff: unknown`. | Nov 01 slip |
| 14 | What **commission do Keeta and Talabat** charge? When do they pay out — weekly, monthly? Are the amounts on the slip before or after commission is deducted? | Needed to calculate true delivery revenue and the profit formula. Currently commission = 0 (default setting). | Brief |
| 15 | **Who sends the slip** each day, and at approximately what time? Is it always the same person, or different staff? | Affects allow-list setup and whether sender name matters for validation. | Brief |
| 16 | **What does he most want to see first** when he opens the app? Today's sales? Monthly profit? The review queue? | Determines which screen is the home screen. | Brief |
| 17 | Are there **card machine fees** (POS terminal fees) or **delays** before card/ATM money reaches the bank account? | Affects cash flow view — card "sales" may not equal card "received". | Brief |
| 18 | **How are the remaining salaries paid** (the portion not taken from the counter)? Bank transfer, cash, other? Is it recorded anywhere the app can read? | Needed to close the salary tracking loop. Currently only counter salary is tracked. | Brief |
| 19 | What is the **sponsor fee** of QAR 1,500/month for? (Kafala system sponsor?) Is it always the same amount? | Confirm it's a fixed monthly cost as entered. | Brief |

---

## Answered

*(None yet. Move items here when the owner responds.)*

---

## How to Record an Answer

When the owner answers a question:

1. Move the row from **Unanswered** to **Answered** with the answer and date.
2. Update `label_aliases` in the app (Settings → Aliases) with the confirmed category.
3. Run `POST /api/messages/{id}/reparse` for any affected dates to re-categorize historical data.
4. If the answer changes a business rule: update `AGENTS.md` and add a line to `CHANGELOG.md`.
