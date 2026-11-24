import { NextRequest, NextResponse } from 'next/server';
import { createOperatorRecord, updateOperatorRoleRecord } from '@/lib/warehouse-store';
import type { OperatorRole } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createOperatorRecord(
      {
        name: String(body.name ?? ''),
        badgeCode: String(body.badgeCode ?? ''),
        role: (body.role ?? 'Operator') as OperatorRole,
      },
      body.actorId ? String(body.actorId) : undefined
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id ?? '');
    if (!id) {
      return NextResponse.json({ error: 'Operator ID is required.' }, { status: 400 });
    }

    const result = updateOperatorRoleRecord(
      id,
      {
        role: body.role as OperatorRole | undefined,
        active: typeof body.active === 'boolean' ? body.active : undefined,
      },
      body.actorId ? String(body.actorId) : undefined
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }
}
