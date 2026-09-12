import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/format";
import { EventCard } from "@/components/event-card";
import { LiveFeed } from "@/components/live-feed";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

async function getHomeData() {
  const now = new Date();
  const [featured, cats, recentBookings, counts] = await Promise.all([
    prisma.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: {
        tiers: { select: { pricePs: true, capacity: true, sold: true } },
        organizer: { select: { name: true } },
        profile: { select: { orgName: true, status: true } },
      },
    }),
    prisma.event.groupBy({ by: ["category"], _count: true, where: { status: "PUBLISHED" } }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: {
        event: { select: { title: true, slug: true } },
        user: { select: { name: true } },
      },
    }),
    Promise.all([
      prisma.event.count({ where: { status: "PUBLISHED" } }),
      prisma.user.count(),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
    ]),
  ]);

  const categoryCounts = new Map(cats.map((c) => [c.category, c._count]));
  const initialBookings = recentBookings.map((b) => ({
    id: b.id,
    name: b.user?.name?.split(" ")[0] ?? "Someone",
    title: b.event.title,
    slug: b.event.slug,
    at: b.updatedAt.toISOString(),
  }));
  return { featured, categoryCounts, initialBookings, counts };
}

export default async function HomePage() {
  const { featured, categoryCounts, initialBookings, counts } = await getHomeData();
  const [events, users, bookings] = counts;

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-purple-600 p-8 text-white shadow-pop md:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-purple-400/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
        />

        <div className="relative max-w-2xl">
          <div className="anim-hero-3 chip mb-4 bg-white/15 text-white ring-1 ring-inset ring-white/25">
            🎟️ Real-time ticketing marketplace
          </div>
          <h1 className="anim-hero text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Discover events. Book in seconds.
            <br />
            <span className="bg-gradient-to-r from-brand-200 to-purple-200 bg-clip-text text-transparent">
              Walk in with a QR pass.
            </span>
          </h1>
          <p className="anim-hero-2 mt-4 max-w-xl text-sm text-brand-100 md:text-base">
            Live availability, 10-minute seat holds, secure payments, instant digital tickets and
            organizer check-in tools — the full lifecycle in one place.
          </p>
          <div className="anim-hero-2 mt-6 flex flex-wrap gap-3">
            <Link
              href="/browse"
              className="btn bg-white text-brand-700 shadow-sm transition hover:bg-brand-50 hover:shadow-md"
            >
              Browse events →
            </Link>
            <Link
              href="/organizer/onboarding"
              className="btn border border-white/40 text-white transition hover:bg-white/10"
            >
              Host an event
            </Link>
          </div>
          <div className="anim-hero-3 mt-8 flex divide-x divide-white/20 gap-6 text-sm [&>*]:pr-6 [&>*:first-child]:pl-0">
            <div>
              <div className="text-2xl font-extrabold tabular-nums">{events}</div>
              <div className="text-brand-200">live events</div>
            </div>
            <div className="pl-6">
              <div className="text-2xl font-extrabold tabular-nums">{users}</div>
              <div className="text-brand-200">members</div>
            </div>
            <div className="pl-6">
              <div className="text-2xl font-extrabold tabular-nums">{bookings}</div>
              <div className="text-brand-200">tickets booked</div>
            </div>
          </div>
        </div>
      </section>

      <LiveFeed initial={initialBookings} />

      <Reveal>
        <section>
          <h2 className="mb-3 text-xl font-extrabold tracking-tight">Browse by category</h2>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-9">
            {CATEGORIES.map((c) => (
              <Link
                key={c}
                href={`/browse?category=${encodeURIComponent(c)}`}
                className="card group flex flex-col items-center gap-1.5 p-4 text-center transition hover:-translate-y-0.5 hover:border-brand-300 dark:hover:border-brand-500/60 hover:shadow-pop"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 dark:bg-brand-500/15 text-xl transition group-hover:scale-110">
                  {CATEGORY_EMOJI[c]}
                </span>
                <span className="text-xs font-semibold">{c}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {categoryCounts.get(c) ?? 0} event{(categoryCounts.get(c) ?? 0) === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-xl font-extrabold tracking-tight">Coming up next</h2>
            <Link
              href="/browse"
              className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline"
            >
              View all →
            </Link>
          </div>
          {featured.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No events published yet. Organizers:{" "}
              <Link href="/organizer/onboarding" className="font-semibold text-brand-700 dark:text-brand-300">
                create one
              </Link>
              .
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((e, i) => {
                const prices = e.tiers.map((t) => t.pricePs);
                const capacity = e.tiers.reduce((s, t) => s + t.capacity, 0);
                const sold = e.tiers.reduce((s, t) => s + t.sold, 0);
                return (
                  <EventCard
                    key={e.id}
                    index={i}
                    event={{
                      slug: e.slug,
                      title: e.title,
                      category: e.category,
                      bannerUrl: e.bannerUrl,
                      venueName: e.venueName,
                      city: e.city,
                      startsAt: e.startsAt,
                      soldOut: e.soldOut,
                      liveMode: e.liveMode,
                      minPricePs: prices.length ? Math.min(...prices) : 0,
                      soldPct: capacity ? Math.round((sold / capacity) * 100) : 0,
                      organizer: e.profile?.orgName ?? e.organizer.name,
                      verified: e.profile?.status === "VERIFIED",
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
      </Reveal>

      <Reveal>
        <section>
          <h2 className="mb-3 text-xl font-extrabold tracking-tight">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["1", "🔍", "Find your event", "Search by category, city or date with live availability on every listing."],
              ["2", "⏳", "Hold & pay", "Tickets are held for 10 minutes while you pay securely — no overselling, ever."],
              ["3", "📱", "Show your QR", "Your digital pass carries a signed QR code the organizer scans at the gate."],
            ].map(([num, emoji, title, body]) => (
              <div
                key={title}
                className="card relative p-5 transition hover:-translate-y-0.5 hover:shadow-pop"
              >
                <span className="absolute right-4 top-4 select-none text-4xl font-black text-slate-100 dark:text-slate-800">
                  {num}
                </span>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 dark:bg-brand-500/15 text-xl">
                  {emoji}
                </div>
                <div className="mt-3 font-bold">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
