import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { verifyAndCheckIn } from "@/lib/checkin";
import { audit } from "@/lib/audit";
import { publishEventUpdate } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const schema = z.object({
  payload: z.string().min(5),
  eventId: z.string().optional(),
  force: z.boolean().optional(),
});

/** Gate scanner: verify a QR ticket and check the attendee in. */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json());

  const result = await verifyAndCheckIn({
    payload: body.payload,
    scannerId: user.id,
    force: body.force,
  });
  if (!result.alreadyCheckedIn) {
    await audit({
      actorId: user.id,
      action: "ticket.checkin",
      entity: "Ticket",
      metadata: { attendee: result.attendee, seat: result.seat },
    });
  }
  return ok(result);
});

/** Check-in stats across all my events (for the gate console header). */
export const GET = handler(async () => {
  const user = await requireRole("ORGANIZER", "ADMIN");
  const events = await prisma.event.findMany({
    where: { organizerId: user.id },
    select: {
      id: true, title: true, startsAt: true, liveMode: true, status: true,
      tiers: { include: { tickets: { select: { checkedInAt: true } } } },
    },
    orderBy: { startsAt: "asc" },
  });
  return ok({
    events: events.map((e) => {
      const tickets = e.tiers.flatMap((t) => t.tickets);
      return {
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
        liveMode: e.liveMode,
        status: e.status,
        total: tickets.length,
        checkedIn: tickets.filter((t) => t.checkedInAt).length,
      };
    }),
  });
});
