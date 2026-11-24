import { NextRequest, NextResponse } from 'next/server';
import {
  encodeSseEvent,
  getWarehouseSnapshot,
  subscribeToStream,
  updateSessionOperator,
} from '@/lib/warehouse-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const keepaliveEncoder = new TextEncoder();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId') || `client-${Date.now()}`;
  const operatorId = searchParams.get('operatorId') || 'op-1';

  let cleanup = () => {};
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let onAbort: (() => void) | null = null;

  const teardown = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (onAbort) {
      request.signal.removeEventListener('abort', onAbort);
      onAbort = null;
    }
    cleanup();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendChunk = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          teardown();
        }
      };

      cleanup = subscribeToStream(sendChunk, { clientId, operatorId });

      const initial = getWarehouseSnapshot();
      sendChunk(
        encodeSseEvent({
          type: 'init',
          state: initial.state,
          activeSessions: initial.activeSessions,
        })
      );

      heartbeat = setInterval(() => {
        sendChunk(keepaliveEncoder.encode(`: keepalive ${Date.now()}\n\n`));
      }, 20000);

      onAbort = () => {
        teardown();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      request.signal.addEventListener('abort', onAbort, { once: true });
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientId = String(body.clientId ?? '').trim();
    const operatorId = String(body.operatorId ?? '').trim();
    if (!clientId || !operatorId) {
      return NextResponse.json(
        { error: 'clientId and operatorId are required.' },
        { status: 400 }
      );
    }
    const activeSessions = updateSessionOperator(clientId, operatorId);
    return NextResponse.json({ activeSessions });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }
}
