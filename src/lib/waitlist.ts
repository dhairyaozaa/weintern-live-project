import { prisma } from "./prisma";
import { notify } from "./notifications";

/**
 * Notify the earliest waitlist entries when stock becomes available.
 * Returns number of users notified.
 */
export async function offerWaitlistSlots(eventId: string, tierId?: string) {
  const entries = await prisma.waitlistEntry.findMany({
    where: { eventId, notifiedAt: null, convertedBookingId: null, ...(tierId ? { tierId } : {}) },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { event: { select: { title: true, slug: true } } },
  });
  for (const e of entries) {
    await prisma.waitlistEntry.update({
      where: { id: e.id },
      data: { notifiedAt: new Date() },
    });
    await notify({
      userId: e.userId,
      kind: "WAITLIST",
      title: "Tickets just opened up!",
      body: `A limited number of tickets for “${e.event.title}” are available again. Grab yours before they're gone.`,
      link: `/events/${e.event.slug}`,
    });
  }
  return entries.length;
}

/** Join (or refresh) the waitlist for an event. */
export async function joinWaitlist(params: {
  eventId: string;
  userId: string;
  quantity: number;
  tierId?: string | null;
}) {
  const event = await prisma.event.findUnique({ where: { id: params.eventId } });
  if (!event) return { ok: false as const, error: "Event not found" };
  const existing = await prisma.waitlistEntry.findUnique({
    where: { eventId_userId: { eventId: params.eventId, userId: params.userId } },
  });
  if (existing) {
    await prisma.waitlistEntry.update({
      where: { id: existing.id },
      data: { quantity: params.quantity, notifiedAt: null, tierId: params.tierId ?? null },
    });
    return { ok: true as const, position: null };
  }
  const count = await prisma.waitlistEntry.count({ where: { eventId: params.eventId } });
  await prisma.waitlistEntry.create({
    data: {
      eventId: params.eventId,
      userId: params.userId,
      quantity: params.quantity,
      tierId: params.tierId ?? null,
    },
  });
  return { ok: true as const, position: count + 1 };
}
