import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  const days = db.store.getDays(from, to);
  const reviewQueue = db.store.getReviewQueue();

  return NextResponse.json({
    days,
    needs_review_count: reviewQueue.length,
    total_count: days.length,
  });
}
