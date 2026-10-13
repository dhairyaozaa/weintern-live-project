import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler, pageParams } from "@/lib/api";
import { ApiError, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Music", "Tech", "Sports", "Comedy", "Theatre", "Food", "Business", "Art", "Wellness",
];

function buildWhere(url: URL) {
  const q = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const city = url.searchParams.get("city")?.trim();
  const when = url.searchParams.get("when"); // all | today | week | month
  const maxPrice = Number(url.searchParams.get("maxPrice") ?? 0); // rupees

  const now = new Date();
  let startsAt: Record<string, Date> | undefined;
  if (when === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    startsAt = { gte: now, lte: end };
  } else if (when === "week") {
    const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    startsAt = { gte: now, lte: end };
  } else if (when === "month") {
    const end = new Date(now.getTime() + 31 * 24 * 3600 * 1000);
    startsAt = { gte: now, lte: end };
  } else {
    startsAt = { gte: now };
  }

  return {
    status: "PUBLISHED" as const,
    AND: [
      { startsAt },
      ...(q
        ? [{
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
              { venueName: { contains: q, mode: "insensitive" as const } },
            ],
          }]
        : []),
      ...(category && category !== "all" ? [{ category }] : []),
      ...(city && city !== "all" ? [{ city: { equals: city, mode: "insensitive" as const } }] : []),
      // hide sold-out events when maxPrice filter used (price filter over min tier price)
      ...(maxPrice > 0
        ? [{ tiers: { some: { pricePs: { lte: maxPrice * 100 } } } }]
        : []),
    ],
  };
}

/** Public: search & filter published events. */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const { page, take, skip } = pageParams(req);
  const where = buildWhere(url);
  const sort = url.searchParams.get("sort") ?? "soon";

  // "price" sorting is applied in JS after aggregation (Prisma can't order by relation min).
  const orderBy = sort === "popular" ? { viewCount: "desc" as const } : { startsAt: "asc" as const };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        tiers: { select: { pricePs: true, capacity: true, sold: true } },
        organizer: { select: { name: true } },
        profile: { select: { orgName: true, status: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  if (sort === "price") {
    events.sort((a, b) => Math.min(...a.tiers.map((t) => t.pricePs)) - Math.min(...b.tiers.map((t) => t.pricePs)));
  }

  return ok({
    total,
    page,
    events: events.map((e) => {
      const prices = e.tiers.map((t) => t.pricePs);
      const capacity = e.tiers.reduce((s, t) => s + t.capacity, 0);
      const sold = e.tiers.reduce((s, t) => s + t.sold, 0);
      return {
        id: e.id,
        slug: e.slug,
        title: e.title,
        category: e.category,
        bannerUrl: e.bannerUrl,
        venueName: e.venueName,
        city: e.city,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        soldOut: e.soldOut,
        liveMode: e.liveMode,
        viewCount: e.viewCount,
        organizer: e.profile?.orgName ?? e.organizer.name,
        verified: e.profile?.status === "VERIFIED",
        minPricePs: prices.length ? Math.min(...prices) : 0,
        maxPricePs: prices.length ? Math.max(...prices) : 0,
        soldPct: capacity ? Math.round((sold / capacity) * 100) : 0,
      };
    }),
  });
});
