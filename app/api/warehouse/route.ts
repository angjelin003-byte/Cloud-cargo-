import { NextRequest, NextResponse } from 'next/server';
import { clearAllWarehouseData, getWarehouseSnapshot } from '@/lib/warehouse-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = getWarehouseSnapshot();
  return NextResponse.json(snapshot);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeOperators = searchParams.get('includeOperators') === 'true';
  const operatorId = searchParams.get('operatorId') || undefined;
  const snapshot = clearAllWarehouseData({ includeOperators }, operatorId);
  return NextResponse.json(snapshot);
}
