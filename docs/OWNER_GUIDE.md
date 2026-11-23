# Owner Guide — Lulu Juicer Dashboard

> One page for the shop owner. Plain English. No technical terms.

---

## How to send your daily slip

Send your slip to the **Lulu Juicer Telegram group**. The bot reads it and saves it to the app automatically. You will get a reply in a few seconds.

**Always use this format:**

```
Lulu Juicer | 23 Nov 2026
Expenses (QAR)
Rawabi – 500
PT – 20
Mijan salary – 200
Total expenses – 720

ATM (QAR)
300
220
500
Total ATM – 1,020

Total on bill – QAR 1,740
Keeta – 50
Talabat – 30
```

**Important tips:**
- Write the **date** at the top: day, month, year. Example: `23 Nov 2026`
- Use `–` (dash) between the name and the number.
- Write the name of the staff member on every salary line. Example: `Mijan salary – 200` not just `salary – 200`.
- If Keeta had no sales, write `Keeta – blank`. Do not leave the line out.
- If Talabat had no sales, write `Talabat – blank`.

---

## What the bot replies

| Bot says | What it means |
|---|---|
| ✅ 23 Nov saved. Shop 1,740 · Keeta 50 · Talabat 30 | Perfect. Everything saved. |
| ✅ 23 Nov saved. Small difference of 9 in the totals, will check. | Saved. The numbers are very close, we will confirm it. |
| 📝 23 Nov saved. Totals need a check, I will show it in the app. | Saved. Please open the app when you can and check the Review screen. |
| 🔄 23 Nov updated. | You sent this day's slip before. It has been updated with the new numbers. |
| 📝 Saved. Please add the staff name to the salary line next time. | We saved it, but we could not tell whose salary it is. Next time write the name. |
| 📝 Got it. I will read it and show it in the app for checking. | You sent a photo or voice note. We will read it and show it on the Review screen. |
| 📝 Saved. I could not read this one, it will show in the app for checking. | The message was unclear. We will check it manually. |
| ⏰ No slip for 22 Nov yet. | Reminder. No slip was received for yesterday. |

---

## Bot commands you can type

| Type this | Bot replies with |
|---|---|
| `/today` | Today's total sales and breakdown |
| `/missing` | List of days with no slip this month |
| `/help` | This template |

---

## If you made a mistake

Just **send the corrected slip again** for the same date. The bot will update it and reply "🔄 23 Nov updated." The old version is kept for safety.

---

## Questions?

Contact the developer. Do not worry if the bot says "will check" — your data is always saved first, even if the numbers look strange.
