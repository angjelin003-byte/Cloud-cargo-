import { NextResponse } from 'next/server';
import { formatAuditLogTxt } from '@/lib/warehouse-logic';
import { getWarehouseSnapshot } from '@/lib/warehouse-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = getWarehouseSnapshot();
  const content = formatAuditLogTxt(snapshot.state);

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="log.txt"',
      'Cache-Control': 'no-store',
    },
  });
}
