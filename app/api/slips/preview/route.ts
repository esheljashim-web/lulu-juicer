import { NextRequest, NextResponse } from 'next/server';
import { parseDailySlip } from '@/lib/parser';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = body.text || '';

  const parsed = parseDailySlip(text);

  return NextResponse.json({
    saved: false,
    parsed,
  });
}
