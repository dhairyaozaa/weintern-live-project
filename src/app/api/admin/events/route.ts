import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Admin: list all events for moderation. */
export const GET = handler(async (req: Request) => {
  await requireRole("ADMIN");
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const events = await prisma.event.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      profile: { select: { orgName: true, status: true } },
      organizer: { select: { name: true, email: true } },
      tiers: { select: { sold: true, capacity: true, pricePs: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok({
    events: events.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      status: e.status,
      category: e.category,
      city: e.city,
      startsAt: e.startsAt,
      organizer: e.profile?.orgName ?? e.organizer.name,
      organizerStatus: e.profile?.status,
      sold: e.tiers.reduce((s, t) => s + t.sold, 0),
      capacity: e.tiers.reduce((s, t) => s + t.capacity, 0),
      gmvPs: e.tiers.reduce((s, t) => s + t.sold * t.pricePs, 0),
      createdAt: e.createdAt,
    })),
  });
});

const patchSchema = z.object({
  eventId: z.string(),
  action: z.enum(["approve", "reject", "pause", "takedown"]),
  reason: z.string().max(300).optional(),
});

/** Admin: moderate an event (approve/reject/pause/takedown). */
export const PATCH = handler(async (req: Request) => {
  const admin = await requireRole("ADMIN");
  const body = patchSchema.parse(await req.json());
  const event = await prisma.event.findUnique({ where: { id: body.eventId } });
  if (!event) throw new ApiError(404, "Event not found");

  const map = { approve: "PUBLISHED", reject: "REJECTED", pause: "PAUSED", takedown: "CANCELLED" } as const;
  const status = map[body.action];
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { status },
  });

  await notify({
    userId: event.organizerId,
    kind: "EVENT_UPDATE",
    title:
      status === "PUBLISHED"
        ? `Event approved: ${event.title}`
        : status === "REJECTED"
          ? `Event rejected: ${event.title}`
          : status === "PAUSED"
            ? `Event paused by admin: ${event.title}`
            : `Event taken down: ${event.title}`,
    body: body.reason ?? `Status changed to ${status} by platform moderation.`,
    link: `/events/${event.slug}`,
  });
  await audit({
    actorId: admin.id,
    action: `event.moderate.${body.action}`,
    entity: "Event",
    entityId: event.id,
    metadata: { reason: body.reason },
  });
  return ok({ event: updated });
});
