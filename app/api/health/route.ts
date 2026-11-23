import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const reviewCount = db.store.getReviewQueue().length;

  return NextResponse.json({
    ok: true,
    db: db.isPostgres ? 'postgres_connected' : 'memory_store_active',
    telegram_webhook: true,
    queue_pending: 0,
    needs_review: reviewCount,
    timestamp: new Date().toISOString(),
  });
}
