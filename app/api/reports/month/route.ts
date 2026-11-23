import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || '2026-11';

  const report = db.store.getMonthReport(month);
  return NextResponse.json(report);
}
