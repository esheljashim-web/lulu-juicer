import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const queue = db.store.getReviewQueue();
  return NextResponse.json({
    count: queue.length,
    items: queue,
  });
}
