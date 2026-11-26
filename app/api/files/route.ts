import { NextRequest, NextResponse } from 'next/server';
import {
  createFileRecord,
  deleteFileRecord,
  updateFileRecord,
} from '@/lib/warehouse-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createFileRecord(
      {
        name: String(body.name ?? ''),
        folder: body.folder ? String(body.folder) : 'General',
        content: typeof body.content === 'string' ? body.content : '',
      },
      body.operatorId ? String(body.operatorId) : undefined
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ...result.data, file: result.file }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id ?? '');
    if (!id) {
      return NextResponse.json({ error: 'File ID is required.' }, { status: 400 });
    }

    const result = updateFileRecord(
      id,
      {
        name: String(body.name ?? ''),
        folder: body.folder ? String(body.folder) : 'General',
        content: typeof body.content === 'string' ? body.content : '',
      },
      body.operatorId ? String(body.operatorId) : undefined
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ...result.data, file: result.file });
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
      return NextResponse.json({ error: 'File ID is required.' }, { status: 400 });
    }

    const result = deleteFileRecord(id, operatorId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Failed to delete file.' }, { status: 400 });
  }
}
