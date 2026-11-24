import { NextResponse } from 'next/server';
import { getWarehouseSnapshot } from '@/lib/warehouse-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = getWarehouseSnapshot();
  return NextResponse.json(snapshot);
}
