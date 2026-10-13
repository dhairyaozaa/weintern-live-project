import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rid } from "@/lib/qr";
import { bumpEventsRevision } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const tierSchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(300).optional(),
  price: z.number().min(0), // rupees
  capacity: z.number().int().min(1).max(100_000),
  perUserLimit: z.number().int().min(1).max(50).default(6),
});

const eventSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(10).max(6000),
  category: z.string().min(2),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  venueName: z.string().min(2).max(160),
  city: z.string().min(2).max(80),
  address: z.string().max(300).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  pricingMode: z.enum(["STATIC", "EARLY_BIRD", "DEMAND"]).default("STATIC"),
  earlyBirdEnds: z.string().datetime().optional().nullable(),
  tiers: z.array(tierSchema).min(1).max(10),
});

function assertDates(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) throw new ApiError(400, "End time must be after start time");
}

/** Organizer: create an event (draft) with tiers. */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const body = eventSchema.parse(await req.json());

  const profile = await prisma.organizerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ApiError(403, "Organizer profile missing");

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  assertDates(startsAt, endsAt);

  const event = await prisma.event.create({
    data: {
      slug: `${body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${rid(4).toLowerCase()}`,
      title: body.title,
      description: body.description,
      category: body.category,
      bannerUrl: body.bannerUrl || null,
      venueName: body.venueName,
      city: body.city,
      address: body.address,
      startsAt,
      endsAt,
      pricingMode: body.pricingMode,
      earlyBirdEnds: body.earlyBirdEnds ? new Date(body.earlyBirdEnds) : null,
      status: "DRAFT",
      organizerId: user.id,
      profileId: profile.id,
      tiers: {
        create: body.tiers.map((t, i) => ({
          name: t.name,
          description: t.description,
          pricePs: Math.round(t.price * 100),
          basePricePs: Math.round(t.price * 100),
          capacity: t.capacity,
          perUserLimit: t.perUserLimit,
          dynamicFloorPs: Math.round(t.price * 100),
          position: i,
        })),
      },
    },
    include: { tiers: true },
  });

  await audit({ actorId: user.id, action: "event.create", entity: "Event", entityId: event.id });
  await bumpEventsRevision();
  return ok({ event });
});

/** Organizer: list my events (any status). */
export const PUT = handler(async () => {
  const user = await requireRole("ORGANIZER");
  const events = await prisma.event.findMany({
    where: { organizerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      tiers: { select: { capacity: true, sold: true, pricePs: true } },
      _count: { select: { bookings: true, waitlist: true } },
    },
  });
  return ok({
    events: events.map((e) => {
      const capacity = e.tiers.reduce((s, t) => s + t.capacity, 0);
      const sold = e.tiers.reduce((s, t) => s + t.sold, 0);
      const revenuePs = e.tiers.reduce((s, t) => s + t.sold * t.pricePs, 0);
      return {
        id: e.id,
        slug: e.slug,
        title: e.title,
        status: e.status,
        city: e.city,
        category: e.category,
        startsAt: e.startsAt,
        bannerUrl: e.bannerUrl,
        soldOut: e.soldOut,
        liveMode: e.liveMode,
        capacity,
        sold,
        soldPct: capacity ? Math.round((sold / capacity) * 100) : 0,
        revenuePs,
        bookings: e._count.bookings,
        waitlist: e._count.waitlist,
      };
    }),
  });
});
