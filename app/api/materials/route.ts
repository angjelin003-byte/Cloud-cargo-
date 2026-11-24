import { NextRequest, NextResponse } from 'next/server';
import {
  adjustOrTransferMaterial,
  createMaterialRecord,
  deleteMaterialRecord,
  updateMaterialMetadataRecord,
} from '@/lib/warehouse-store';

function parseNumberField(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createMaterialRecord(
      {
        trackingCode: String(body.trackingCode ?? ''),
        name: String(body.name ?? ''),
        category: String(body.category ?? ''),
        sectionId: String(body.sectionId ?? ''),
        quantity: parseNumberField(body.quantity),
        unit: String(body.unit ?? ''),
        minThreshold: parseNumberField(body.minThreshold),
        lotNumber: body.lotNumber ? String(body.lotNumber) : '',
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
      return NextResponse.json({ error: 'Material ID is required.' }, { status: 400 });
    }

    if (body.action === 'stock') {
      const mode = body.mode as 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST';
      if (!['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUST'].includes(mode)) {
        return NextResponse.json({ error: 'Invalid stock movement mode.' }, { status: 400 });
      }
      const result = adjustOrTransferMaterial(
        {
          id,
          mode,
          delta: body.delta !== undefined ? parseNumberField(body.delta) : 0,
          targetSectionId: body.targetSectionId ? String(body.targetSectionId) : undefined,
          note: body.note ? String(body.note) : undefined,
        },
        body.operatorId ? String(body.operatorId) : undefined
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result.data);
    }

    const result = updateMaterialMetadataRecord(
      id,
      {
        trackingCode: String(body.trackingCode ?? ''),
        name: String(body.name ?? ''),
        category: String(body.category ?? ''),
        sectionId: String(body.sectionId ?? ''),
        quantity: parseNumberField(body.quantity),
        unit: String(body.unit ?? ''),
        minThreshold: parseNumberField(body.minThreshold),
        lotNumber: body.lotNumber ? String(body.lotNumber) : '',
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
      return NextResponse.json({ error: 'Material ID is required.' }, { status: 400 });
    }

    const result = deleteMaterialRecord(id, operatorId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Failed to delete material.' }, { status: 400 });
  }
}
