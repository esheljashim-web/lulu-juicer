import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const success = db.store.resolveReview(
    id,
    body.action || 'approve',
    body.changes,
    body.reason
  );

  if (!success) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Review item not found' } }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id, status: 'approved' });
}
