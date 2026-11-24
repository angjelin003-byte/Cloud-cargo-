import { NextRequest } from 'next/server';
import { getWarehouseSnapshot, subscribeToStream } from '@/lib/warehouse-store';
import type { StreamEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId') || `client-${Date.now()}`;
  const operatorId = searchParams.get('operatorId') || 'op-1';

  const encoder = new TextEncoder();

  let cleanup = () => {};
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: StreamEvent) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream closed
        }
      };

      cleanup = subscribeToStream(send, { clientId, operatorId });

      const initial = getWarehouseSnapshot();
      send({
        type: 'init',
        state: initial.state,
        activeSessions: initial.activeSessions,
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
          cleanup();
        }
      }, 20000);

      request.signal.addEventListener('abort', () => {
        if (heartbeat) clearInterval(heartbeat);
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      cleanup();
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
