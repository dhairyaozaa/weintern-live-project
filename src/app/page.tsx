import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/format";
import { EventCard, CategoryIcon } from "@/components/event-card";
import { LiveFeed } from "@/components/live-feed";
import { Reveal } from "@/components/reveal";
import { ArrowRight, ShieldCheck, Zap, QrCode, Search, Ticket } from "lucide-react";

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
    <div className="space-y-14 pb-12">
      {/* Editorial Architectural Hero with Background */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200/90 p-8 sm:p-12 lg:p-14 shadow-card">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-bg.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
          />
          {/* High-visibility tuned overlay: Minimal gradient on text side, rich vibrant artwork visibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/25 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* Left Column: Mission & CTAs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/95 backdrop-blur px-3.5 py-1.5 text-sm font-bold text-zinc-800 shadow-2xs">
              <span className="inline-block h-2 w-2 bg-zinc-900 shrink-0" />
              Live Marketplace · Cryptographic QR Passes
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 leading-[1.1]">
              Discover live events.
              <br />
              <span className="text-zinc-500 font-bold">Book seats in seconds.</span>
            </h1>

            <p className="max-w-xl text-base sm:text-lg leading-relaxed text-zinc-800 font-medium">
              Direct access to live festivals, tech summits, concerts, and cultural experiences.
              Atomic 10-minute seat reservations ensure zero overselling and seamless gate check-in.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/browse"
                className="btn btn-primary px-6 py-3 text-base font-bold shadow-sm"
              >
                Browse All Events
                <ArrowRight className="h-5 w-5 ml-1.5" />
              </Link>
              <Link
                href="/organizer/onboarding"
                className="btn btn-secondary px-6 py-3 text-base font-bold"
              >
                Host an Event
              </Link>
            </div>
          </div>

          {/* Right Column: Platform Metrics & Guarantees */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="rounded-2xl border border-zinc-200/90 bg-white/90 backdrop-blur-md p-7 space-y-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Network Activity
              </div>
              <div className="grid grid-cols-3 gap-4 divide-x divide-zinc-200 text-center">
                <div className="space-y-1.5">
                  <div className="text-3xl sm:text-4xl font-black text-zinc-900 tabular-nums">
                    {events}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-zinc-600">Live Events</div>
                </div>
                <div className="space-y-1.5 pl-4">
                  <div className="text-3xl sm:text-4xl font-black text-zinc-900 tabular-nums">
                    {users}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-zinc-600">Members</div>
                </div>
                <div className="space-y-1.5 pl-4">
                  <div className="text-3xl sm:text-4xl font-black text-zinc-900 tabular-nums">
                    {bookings}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-zinc-600">Tickets Issued</div>
                </div>
              </div>

              <div className="border-t border-zinc-200/70 pt-5 space-y-3 text-sm text-zinc-700 font-medium">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>Verified organizer payout protections</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Zap className="h-5 w-5 text-amber-600 shrink-0" />
                  <span>Sub-second instant QR pass generation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real-Time Booking Ticker */}
      <LiveFeed initial={initialBookings} />

      {/* Category Endless Connected Square Table Marquee */}
      <Reveal>
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2 w-2 bg-zinc-900 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900">
                Browse by Category
              </h2>
            </div>
            <Link
              href="/browse"
              className="text-sm font-bold text-zinc-600 hover:text-zinc-900 transition flex items-center gap-1.5"
            >
              See all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Endless Connected Square Table Marquee Track with Dotted Line Beam Nodes */}
          <div className="relative w-full overflow-hidden rounded-2xl border-2 border-dotted border-zinc-300 bg-white shadow-sm">
            {/* Top and Bottom Animated Beams */}
            <div className="pointer-events-none absolute -top-[1px] left-0 right-0 h-[2px] overflow-hidden z-20">
              <div className="h-full w-56 bg-gradient-to-r from-transparent via-zinc-900/70 to-transparent animate-beam" />
            </div>
            <div className="pointer-events-none absolute -bottom-[1px] left-0 right-0 h-[2px] overflow-hidden z-20">
              <div className="h-full w-56 bg-gradient-to-r from-transparent via-zinc-900/70 to-transparent animate-beam [animation-delay:2.5s]" />
            </div>

            {/* Corner Beam Nodes */}
            <span className="absolute -top-1 -left-1 h-2 w-2 bg-zinc-900 z-30" />
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-zinc-900 z-30" />
            <span className="absolute -bottom-1 -left-1 h-2 w-2 bg-zinc-900 z-30" />
            <span className="absolute -bottom-1 -right-1 h-2 w-2 bg-zinc-900 z-30" />

            {/* Edge Fade Gradients */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-16 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-16 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

            <div className="animate-table-marquee flex items-stretch">
              {[...CATEGORIES, ...CATEGORIES, ...CATEGORIES, ...CATEGORIES].map((c, idx) => {
                const count = categoryCounts.get(c) ?? 0;
                return (
                  <Link
                    key={`${c}-${idx}`}
                    href={`/browse?category=${encodeURIComponent(c)}`}
                    className="group relative flex aspect-square w-36 h-36 sm:w-44 sm:h-44 shrink-0 flex-col justify-between border-r-2 border-dotted border-zinc-300 bg-white p-4 sm:p-5 transition-all duration-150 hover:bg-zinc-50 select-none"
                  >
                    {/* Top Row: Event Count (Dot Removed) */}
                    <div className="flex items-center justify-end">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-700 transition">
                        {count} {count === 1 ? "event" : "events"}
                      </span>
                    </div>

                    {/* Center: Category Icon */}
                    <div className="my-auto flex flex-col items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 transition duration-150 group-hover:bg-zinc-900 group-hover:text-white group-hover:scale-105 shadow-xs">
                        <CategoryIcon category={c} className="h-6 w-6 stroke-[1.5]" />
                      </div>
                    </div>

                    {/* Bottom: Category Name & Arrow Indicator */}
                    <div className="flex items-center justify-between pt-2 border-t border-dotted border-zinc-200">
                      <span className="text-sm font-extrabold tracking-tight text-zinc-900 group-hover:text-black">
                        {c}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-zinc-400 opacity-0 -translate-x-1 transition duration-150 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-zinc-900" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </Reveal>

      {/* Featured Upcoming Events */}
      <Reveal>
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900">
                Curated Events
              </h2>
              <p className="text-sm text-zinc-500 mt-0.5">Upcoming performances, conferences, and festivals</p>
            </div>
            <Link
              href="/browse"
              className="text-sm font-bold text-zinc-700 hover:text-zinc-900 transition flex items-center gap-1.5"
            >
              Explore directory
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="card p-14 text-center text-base text-zinc-500">
              No events scheduled yet. Organizers can{" "}
              <Link href="/organizer/onboarding" className="font-bold text-zinc-900 underline underline-offset-2">
                publish an event
              </Link>
              .
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* 3-Step Lifecycle */}
      <Reveal>
        <section className="space-y-5 pt-6 border-t border-zinc-200/80">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900">
              How TicketFlow Works
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">Reliable ticketing architecture designed for zero overselling</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="card p-7 space-y-3.5 bg-white border border-zinc-200/80 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                  <Search className="h-5 w-5" />
                </span>
                <span className="text-2xl font-black text-zinc-300">01</span>
              </div>
              <h3 className="text-base font-bold text-zinc-900">Direct Discovery</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Filter events by category, venue, and city with live seating capacity calculated directly from real-time database queries.
              </p>
            </div>

            <div className="card p-7 space-y-3.5 bg-white border border-zinc-200/80 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="text-2xl font-black text-zinc-300">02</span>
              </div>
              <h3 className="text-base font-bold text-zinc-900">Atomic Reservation</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                When you initiate checkout, seats are reserved with a 10-minute hold window. Two buyers racing for the last seat will never cause overselling.
              </p>
            </div>

            <div className="card p-7 space-y-3.5 bg-white border border-zinc-200/80 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                  <QrCode className="h-5 w-5" />
                </span>
                <span className="text-2xl font-black text-zinc-300">03</span>
              </div>
              <h3 className="text-base font-bold text-zinc-900">Cryptographic QR Pass</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Each digital pass includes a signed HMAC token. Organizers scan attendees at the door with instant duplicate detection and offline fallback.
              </p>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
