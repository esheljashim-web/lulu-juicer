import { NextRequest, NextResponse } from 'next/server';
import { parseDailySlip } from '@/lib/parser';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = body.text || '';
  const overrides = body.overrides || {};

  const parsed = parseDailySlip(text);

  const saved = db.store.upsertDay(
    {
      date: parsed.date,
      cash_expenses_stated: overrides.cash_expenses_stated ?? parsed.cash_expenses_stated,
      cash_expenses_calc: parsed.cash_expenses_calc,
      card_atm_stated: overrides.card_atm_stated ?? parsed.card_atm_total,
      card_atm_calc: parsed.card_atm_calc,
      total_on_bill: overrides.total_on_bill ?? parsed.total_on_bill,
      total_on_bill_source: 'stated',
      keeta: overrides.keeta ?? parsed.keeta,
      keeta_status: overrides.keeta_status ?? parsed.keeta_status,
      talabat: overrides.talabat ?? parsed.talabat,
      talabat_status: overrides.talabat_status ?? parsed.talabat_status,
      unlabeled: overrides.unlabeled ?? parsed.unlabeled,
      total_sales: (overrides.total_on_bill ?? parsed.total_on_bill) + (overrides.keeta ?? parsed.keeta) + (overrides.talabat ?? parsed.talabat),
      bill_diff: parsed.total_on_bill - (parsed.cash_expenses_stated + parsed.card_atm_total),
      items_diff: parsed.cash_expenses_calc - parsed.cash_expenses_stated,
      atm_diff: parsed.atm_entries.length > 0 ? parsed.card_atm_calc - parsed.card_atm_total : 0,
      flag: parsed.flag,
      status: parsed.flag,
      raw_text: text,
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

  return NextResponse.json({ ok: true, day: saved });
}
