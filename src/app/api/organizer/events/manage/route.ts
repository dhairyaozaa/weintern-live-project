import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { publishEventUpdate } from "@/lib/realtime";
import { organizerFeeBps } from "@/lib/pricing";
import { getPlatformSettings } from "@/lib/settings";
import { bps } from "@/lib/money";

export const dynamic = "force-dynamic";

async function ownedEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, "Event not found");
  if (event.organizerId !== userId) throw new ApiError(403, "Not your event");
  return event;
}

const patchSchema = z.object({
  action: z.enum(["publish", "pause", "resume", "cancel", "complete", "toggleLive", "updateFields", "updateTier", "addTier"]),
  title: z.string().min(3).max(140).optional(),
  description: z.string().min(10).max(6000).optional(),
  venueName: z.string().min(2).optional(),
  address: z.string().optional(),
  bannerUrl: z.string().optional(),
  earlyBirdEnds: z.string().datetime().optional().nullable(),
  tierId: z.string().optional(),
  price: z.number().min(0).optional(),
  capacity: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).max(50).optional(),
  dynamicFloor: z.number().min(0).optional(),
  name: z.string().min(1).max(40).optional(),
});

/** Organizer: mutate own event (publish, pause, live toggle, edit fields, tier updates). */
export const PATCH = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const body = patchSchema.parse(await req.json());
  const url = new URL(req.url);
  const eventId = url.searchParams.get("id");
  if (!eventId) throw new ApiError(400, "Missing event id");
  const event = await ownedEvent(eventId, user.id);

  switch (body.action) {
    case "publish": {
      const tiers = await prisma.ticketTier.findMany({ where: { eventId } });
      if (!tiers.length) throw new ApiError(400, "Add at least one ticket tier before publishing");
      const startsAt = event.startsAt.getTime();
      if (startsAt < Date.now()) throw new ApiError(400, "Start time is in the past — edit it first");
      const updated = await prisma.event.update({
        where: { id: eventId },
        data: { status: "PUBLISHED" },
      });
      await audit({ actorId: user.id, action: "event.publish", entity: "Event", entityId: eventId });
      publishEventUpdate(eventId, { type: "status", status: updated.status });
      return ok({ event: updated });
    }
    case "pause":
    case "resume": {
      if (event.status !== "PUBLISHED" && event.status !== "PAUSED")
        throw new ApiError(400, "Only published events can be paused/resumed");
      const status = body.action === "pause" ? "PAUSED" : "PUBLISHED";
      const updated = await prisma.event.update({ where: { id: eventId }, data: { status } });
      publishEventUpdate(eventId, { type: "status", status: updated.status });
      return ok({ event: updated });
    }
    case "cancel": {
      if (event.status === "COMPLETED") throw new ApiError(400, "Event already completed");
      const updated = await prisma.event.update({
        where: { id: eventId },
        data: { status: "CANCELLED" },
      });
      const bookings = await prisma.booking.findMany({
        where: { eventId, status: "CONFIRMED" },
        select: { userId: true, reference: true },
      });
      for (const b of bookings) {
        const { notify } = await import("@/lib/notifications");
        await notify({
          userId: b.userId,
          kind: "EVENT_UPDATE",
          title: `Event cancelled: ${event.title}`,
          body: "Your booking will be refunded automatically. Refunds reflect in 5-7 business days.",
          link: "/bookings",
        });
      }
      await audit({ actorId: user.id, action: "event.cancel", entity: "Event", entityId: eventId });
      publishEventUpdate(eventId, { type: "status", status: "CANCELLED" });
      return ok({ event: updated, refundsOwed: bookings.length });
    }
    case "complete": {
      const updated = await prisma.event.update({
        where: { id: eventId },
        data: { status: "COMPLETED", liveMode: false },
      });
      await audit({ actorId: user.id, action: "event.complete", entity: "Event", entityId: eventId });
      publishEventUpdate(eventId, { type: "status", status: updated.status });
      return ok({ event: updated });
    }
    case "toggleLive": {
      const updated = await prisma.event.update({
        where: { id: eventId },
        data: { liveMode: !event.liveMode },
      });
      publishEventUpdate(eventId, { type: "liveMode", liveMode: updated.liveMode });
      return ok({ event: updated });
    }
    case "updateFields": {
      const updated = await prisma.event.update({
        where: { id: eventId },
        data: {
          ...(body.title ? { title: body.title } : {}),
          ...(body.description ? { description: body.description } : {}),
          ...(body.venueName ? { venueName: body.venueName } : {}),
          ...(body.address !== undefined ? { address: body.address } : {}),
          ...(body.bannerUrl !== undefined ? { bannerUrl: body.bannerUrl || null } : {}),
          ...(body.earlyBirdEnds !== undefined
            ? { earlyBirdEnds: body.earlyBirdEnds ? new Date(body.earlyBirdEnds) : null }
            : {}),
        },
      });
      await audit({ actorId: user.id, action: "event.update", entity: "Event", entityId: eventId });
      publishEventUpdate(eventId, { type: "event" });
      return ok({ event: updated });
    }
    case "addTier": {
      if (!body.name || body.price === undefined || !body.capacity)
        throw new ApiError(400, "name, price and capacity are required");
      const count = await prisma.ticketTier.count({ where: { eventId } });
      const tier = await prisma.ticketTier.create({
        data: {
          eventId,
          name: body.name,
          pricePs: Math.round(body.price * 100),
          basePricePs: Math.round(body.price * 100),
          capacity: body.capacity,
          perUserLimit: body.perUserLimit ?? 6,
          dynamicFloorPs: Math.round((body.dynamicFloor ?? body.price) * 100),
          position: count,
        },
      });
      publishEventUpdate(eventId, { type: "tiers" });
      return ok({ tier });
    }
    case "updateTier": {
      if (!body.tierId) throw new ApiError(400, "Missing tierId");
      const tier = await prisma.ticketTier.findUnique({ where: { id: body.tierId } });
      if (!tier || tier.eventId !== eventId) throw new ApiError(404, "Tier not found");

      if (body.capacity !== undefined && body.capacity < tier.sold)
        throw new ApiError(400, `Capacity cannot go below ${tier.sold} already-sold tickets`);

      const updated = await prisma.ticketTier.update({
        where: { id: tier.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.price !== undefined ? { pricePs: Math.round(body.price * 100) } : {}),
          ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
          ...(body.perUserLimit !== undefined ? { perUserLimit: body.perUserLimit } : {}),
          ...(body.dynamicFloor !== undefined
            ? { dynamicFloorPs: Math.round(body.dynamicFloor * 100) }
            : {}),
        },
      });
      await audit({
        actorId: user.id,
        action: "tier.update",
        entity: "TicketTier",
        entityId: tier.id,
        metadata: { eventId },
      });
      publishEventUpdate(eventId, { type: "tiers" });
      return ok({ tier: updated });
    }
  }
});

/** Organizer: detailed stats for one event (sales, revenue, commission, attendees). */
export const GET = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const url = new URL(req.url);
  const eventId = url.searchParams.get("id");
  if (!eventId) throw new ApiError(400, "Missing event id");
  const event = await ownedEvent(eventId, user.id);

  const [tiers, bookings, settings, feeBps] = await Promise.all([
    prisma.ticketTier.findMany({ where: { eventId }, orderBy: { position: "asc" } }),
    prisma.booking.findMany({
      where: { eventId, status: { in: ["CONFIRMED", "REFUNDED"] } },
      include: { user: { select: { name: true, email: true } }, tickets: true, refunds: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    getPlatformSettings(),
    organizerFeeBps(eventId),
  ]);

  const grossPs = tiers.reduce((s, t) => s + t.sold * t.pricePs, 0);
  const commissionPs = bps(grossPs, feeBps);
  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const ticketsSold = tiers.reduce((s, t) => s + t.sold, 0);
  const checkedIn = confirmedBookings.reduce(
    (s, b) => s + b.tickets.filter((t) => t.checkedInAt).length,
    0
  );
  const refundedPs = bookings.reduce(
    (s, b) => s + b.refunds.filter((r) => r.status === "COMPLETED").reduce((x, r) => x + r.amountPs, 0),
    0
  );

  return ok({
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      status: event.status,
      liveMode: event.liveMode,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venueName: event.venueName,
      city: event.city,
      bannerUrl: event.bannerUrl,
      category: event.category,
      description: event.description,
      pricingMode: event.pricingMode,
      earlyBirdEnds: event.earlyBirdEnds,
      soldOut: event.soldOut,
    },
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      pricePs: t.pricePs,
      basePricePs: t.basePricePs,
      dynamicFloorPs: t.dynamicFloorPs,
      capacity: t.capacity,
      sold: t.sold,
      heldCount: t.heldCount,
      perUserLimit: t.perUserLimit,
      remaining: Math.max(0, t.capacity - t.sold - t.heldCount),
    })),
    stats: {
      grossPs,
      commissionPs,
      netPs: grossPs - commissionPs,
      refundedPs,
      feeBps,
      convenienceBps: settings.convenienceBps,
      ticketsSold,
      checkedIn,
      bookings: confirmedBookings.length,
    },
    attendees: confirmedBookings.map((b) => ({
      bookingRef: b.reference,
      userName: b.user.name,
      email: b.user.email,
      tickets: b.tickets.length,
      checkedIn: b.tickets.filter((t) => t.checkedInAt).length,
      totalPs: b.totalPs,
      status: b.status,
      createdAt: b.createdAt,
    })),
    bookings: bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      userName: b.user.name,
      tickets: b.tickets.length,
      totalPs: b.totalPs,
      status: b.status,
      createdAt: b.createdAt,
    })),
  });
});
