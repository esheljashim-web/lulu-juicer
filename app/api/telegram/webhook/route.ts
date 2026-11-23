import { NextRequest, NextResponse } from 'next/server';
import { parseDailySlip } from '@/lib/parser';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Secret Header (fail: 401, nothing else happens)
    const secret = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const update = await req.json();

    // 2. Validate update structure
    const message = update.message || update.edited_message;
    if (!message) {
      return NextResponse.json({ ok: true, ignored: 'no_message' });
    }

    const senderId = message.from?.id ? String(message.from.id) : null;
    const allowedSenders = (process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

    // 3. Allow-list check (if configured)
    if (allowedSenders.length > 0 && senderId && !allowedSenders.includes(senderId)) {
      console.log(`[Telegram] Sender ${senderId} not on allow-list. Ignored.`);
      return NextResponse.json({ ok: true, ignored: 'sender_not_allowed' });
    }

    const rawText = message.text || message.caption || '';
    if (!rawText.trim()) {
      return NextResponse.json({ ok: true, ignored: 'empty_text' });
    }

    // 4. Parse the slip using the rule-based parser
    const parsed = parseDailySlip(rawText);

    // 5. Upsert to DB / store
    const saved = db.store.upsertDay(
      {
        date: parsed.date,
        cash_expenses_stated: parsed.cash_expenses_stated,
        cash_expenses_calc: parsed.cash_expenses_calc,
        card_atm_stated: parsed.card_atm_total,
        card_atm_calc: parsed.card_atm_calc,
        total_on_bill: parsed.total_on_bill,
        total_on_bill_source: 'stated',
        keeta: parsed.keeta,
        keeta_status: parsed.keeta_status,
        talabat: parsed.talabat,
        talabat_status: parsed.talabat_status,
        unlabeled: parsed.unlabeled,
        total_sales: parsed.total_on_bill + parsed.keeta + parsed.talabat,
        bill_diff: parsed.total_on_bill - (parsed.cash_expenses_stated + parsed.card_atm_total),
        items_diff: parsed.cash_expenses_calc - parsed.cash_expenses_stated,
        atm_diff: parsed.atm_entries.length > 0 ? parsed.card_atm_calc - parsed.card_atm_total : 0,
        flag: parsed.flag,
        status: parsed.flag,
        raw_text: rawText,
        atm_entries: parsed.atm_entries,
      },
      parsed.expense_items.map(([lbl, amt], idx) => ({
        label_raw: lbl,
        label_normalized: lbl,
        category: 'Uncategorised',
        amount: amt,
        position: idx,
      }))
    );

    // 6. Build Calm Bot Reply (Never use "error", "failed", "invalid")
    let replyText = '';
    const dateFormatted = parsed.date;

    if (parsed.flag === 'ok') {
      replyText = `✅ ${dateFormatted} saved. Shop ${parsed.total_on_bill.toLocaleString()} · Keeta ${parsed.keeta} · Talabat ${parsed.talabat}`;
    } else {
      replyText = `📝 ${dateFormatted} saved. Totals need a check, I will show it in the app.`;
    }

    // 7. Send Telegram reply if token exists (non-blocking)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = message.chat?.id;

    if (botToken && chatId) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            reply_to_message_id: message.message_id,
            text: replyText,
          }),
        });
      } catch (err) {
        console.error('[Telegram] Bot reply failed (non-fatal):', err);
      }
    }

    return NextResponse.json({ ok: true, date: parsed.date, flag: parsed.flag });
  } catch (error: any) {
    console.error('[Telegram] Webhook internal error:', error);
    // Never return 500 to Telegram for content issues
    return NextResponse.json({ ok: true, status: 'needs_review' });
  }
}
