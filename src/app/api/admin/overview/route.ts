import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Admin: platform-wide KPIs for the overview dashboard. */
export const GET = handler(async () => {
  await requireRole("ADMIN");

  const [users, organizers, events, bookings, refundedAgg, settings] = await Promise.all([
    prisma.user.count(),
    prisma.organizerProfile.findMany({ include: { user: { select: { name: true, email: true } } } }),
    prisma.event.findMany({
      include: { tiers: { select: { sold: true, pricePs: true, capacity: true } }, profile: { select: { orgName: true } } },
    }),
    prisma.booking.findMany({
      where: { status: { in: ["CONFIRMED", "REFUNDED"] } },
      select: { totalPs: true, feePs: true, discountPs: true, subtotalPs: true, status: true, createdAt: true },
    }),
    prisma.refund.aggregate({ where: { status: "COMPLETED" }, _sum: { amountPs: true } }),
    getPlatformSettings(),
  ]);

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const grossPs = confirmed.reduce((s, b) => s + b.subtotalPs - b.discountPs, 0);
  const netPs = bookings.reduce((s, b) => s + b.totalPs, 0) - refundedAgg._sum.amountPs!;

  const byDay = new Map<string, number>();
  for (const b of confirmed) {
    const day = b.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (b.subtotalPs - b.discountPs));
  }
  const salesSeries = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([day, ps]) => ({ day, gmvPs: ps }));

  const topEvents = events
    .map((e) => ({
      title: e.title,
      slug: e.slug,
      organizer: e.profile?.orgName ?? "—",
      gmvPs: e.tiers.reduce((s, t) => s + t.sold * t.pricePs, 0),
      soldPct:
        e.tiers.reduce((s, t) => s + t.capacity, 0) > 0
          ? Math.round(
              (e.tiers.reduce((s, t) => s + t.sold, 0) /
                e.tiers.reduce((s, t) => s + t.capacity, 0)) *
                100
            )
          : 0,
    }))
    .sort((a, b) => b.gmvPs - a.gmvPs)
    .slice(0, 5);

  return ok({
    kpis: {
      users,
      organizers: organizers.length,
      pendingOrganizers: organizers.filter((o) => o.status === "PENDING").length,
      events: events.length,
      publishedEvents: events.filter((e) => e.status === "PUBLISHED").length,
      bookings: confirmed.length,
      gmvPs: grossPs,
      commissionEstPs: Math.round((grossPs * settings.feeBps) / 10_000),
      refundedPs: refundedAgg._sum.amountPs ?? 0,
      netPs,
    },
    settings,
    salesSeries,
    topEvents,
  });
});
