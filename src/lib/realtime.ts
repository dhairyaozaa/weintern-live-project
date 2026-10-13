import { prisma } from "./prisma";

type Payload = Record<string, unknown>;

/** Broadcast to all SSE subscribers of an event channel. */
export function publishEventUpdate(eventId: string, payload: Payload) {
  const bus = getBus();
  const subs = bus.get(eventId);
  if (!subs) return;
  const frame = `data: ${JSON.stringify({ ...payload, ts: Date.now() })}\n\n`;
  for (const ctrl of subs) {
    try {
      ctrl.enqueue(encoder.encode(frame));
    } catch {
      // subscriber vanished; drop silently
    }
  }
}

const encoder = new TextEncoder();

const globalForBus = globalThis as unknown as {
  __tfBus?: Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>;
};
function getBus() {
  if (!globalForBus.__tfBus) globalForBus.__tfBus = new Map();
  return globalForBus.__tfBus;
}

export function subscribe(eventId: string) {
  const bus = getBus();
  if (!bus.has(eventId)) bus.set(eventId, new Set());
  const set = bus.get(eventId)!;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
      set.add(controller);
    },
    cancel() {
      set.delete(controller);
      if (set.size === 0) bus.delete(eventId);
    },
  });
  return stream;
}

/** Invalidate the public events list cache (called on publish/update). */
export async function bumpEventsRevision() {
  await prisma.$queryRaw`SELECT 1`.catch(() => {});
  const g = globalThis as unknown as { __tfEventsRev?: number };
  g.__tfEventsRev = (g.__tfEventsRev ?? 0) + 1;
}
