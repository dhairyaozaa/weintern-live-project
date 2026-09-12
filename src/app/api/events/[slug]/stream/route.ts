import { prisma } from "@/lib/prisma";
import { subscribe } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** SSE stream: live availability + status updates for one event. */
export async function GET(_req: Request, ctx: { params: { slug: string } }) {
  const { slug } = ctx.params;
  const event = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
  if (!event) return new Response("event not found", { status: 404 });

  const stream = subscribe(event.id);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
