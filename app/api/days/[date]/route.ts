import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const day = db.store.getDay(date);

  if (!day) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Day not found' } }, { status: 404 });
  }

  return NextResponse.json(day);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const body = await req.json();

  const current = db.store.getDay(date);
  if (!current) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Day not found' } }, { status: 404 });
  }

  // Version check (optimistic lock)
  if (body.version && current.version && body.version !== current.version) {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'Version conflict' }, current },
      { status: 409 }
    );
  }

  const updated = db.store.upsertDay(
    {
      ...current,
      ...body,
      date,
      status: body.status || 'approved',
      flag: 'ok',
    },
    body.items || current.items || []
  );

  return NextResponse.json(updated);
}
