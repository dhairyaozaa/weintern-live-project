import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(1000),
  target: z.enum(["ALL", "CONFIRMED"]).default("ALL"),
});

/** Organizer: broadcast an announcement to event attendees. */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const url = new URL(req.url);
  const eventId = url.searchParams.get("id");
  if (!eventId) throw new ApiError(400, "Missing event id");

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, "Event not found");
  if (event.organizerId !== user.id) throw new ApiError(403, "Not your event");

  const payload = schema.parse(await req.json());

  const bookings = await prisma.booking.findMany({
    where: {
      eventId,
      ...(payload.target === "CONFIRMED" ? { status: "CONFIRMED" } : {}),
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  await prisma.broadcast.create({
    data: { eventId, title: payload.title, body: payload.body },
  });
  for (const b of bookings) {
    await notify({
      userId: b.userId,
      kind: "EVENT_UPDATE",
      title: payload.title,
      body: payload.body,
      link: `/events/${event.slug}`,
    });
  }
  await audit({
    actorId: user.id,
    action: "event.broadcast",
    entity: "Event",
    entityId: eventId,
    metadata: { recipients: bookings.length },
  });
  return ok({ sent: bookings.length });
});

/** Organizer: past broadcasts for the event. */
export const GET = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const url = new URL(req.url);
  const eventId = url.searchParams.get("id");
  if (!eventId) throw new ApiError(400, "Missing event id");
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, "Event not found");
  if (event.organizerId !== user.id) throw new ApiError(403, "Not your event");
  const broadcasts = await prisma.broadcast.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({ broadcasts });
});
