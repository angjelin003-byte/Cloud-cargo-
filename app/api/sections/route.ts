import { NextRequest, NextResponse } from 'next/server';
import {
  createSectionRecord,
  deleteSectionRecord,
  updateSectionRecord,
} from '@/lib/warehouse-store';

function parseNumberField(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createSectionRecord(
      {
        code: String(body.code ?? ''),
        name: String(body.name ?? ''),
        zone: String(body.zone ?? ''),
        capacity: parseNumberField(body.capacity),
        description: String(body.description ?? ''),
      },
      body.operatorId ? String(body.operatorId) : undefined
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
      return NextResponse.json({ error: 'Section ID is required.' }, { status: 400 });
    }

    const result = updateSectionRecord(
      id,
      {
        code: String(body.code ?? ''),
        name: String(body.name ?? ''),
        zone: String(body.zone ?? ''),
        capacity: parseNumberField(body.capacity),
        description: String(body.description ?? ''),
      },
      body.operatorId ? String(body.operatorId) : undefined
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    const operatorId = searchParams.get('operatorId') || undefined;
    if (!id) {
      return NextResponse.json({ error: 'Section ID is required.' }, { status: 400 });
    }

    const result = deleteSectionRecord(id, operatorId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Failed to delete section.' }, { status: 400 });
  }
}
