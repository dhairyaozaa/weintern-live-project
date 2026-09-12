/**
 * Seed script: demo users (customer/organizer/admin), 6 events with tiers,
 * global + event coupons, some confirmed bookings for analytics.
 *
 * Run: npm run db:push && npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_PASSWORD || "Password@123";

function daysFromNow(days: number, hour = 19, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function slugify(s: string, suffix: string) {
  return `${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${suffix}`;
}

async function main() {
  console.log("🌱 Seeding TicketFlow…");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Users ──────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.io" },
    update: {},
    create: { name: "Aarav Admin", email: "admin@demo.io", passwordHash, role: "ADMIN" },
  });

  const organizer = await prisma.user.upsert({
    where: { email: "organizer@demo.io" },
    update: {},
    create: { name: "Riya Organizer", email: "organizer@demo.io", passwordHash, role: "ORGANIZER" },
  });
  const organizerProfile = await prisma.organizerProfile.upsert({
    where: { userId: organizer.id },
    update: {},
    create: {
      userId: organizer.id,
      orgName: "Nimbus Live Events",
      about: "Bengaluru's favourite indie music & tech festival crew since 2018.",
      supportEmail: "help@nimbuslive.in",
      status: "VERIFIED",
    },
  });

  const organizer2 = await prisma.user.upsert({
    where: { email: "second.organizer@demo.io" },
    update: {},
    create: { name: "Karan Kulkarni", email: "second.organizer@demo.io", passwordHash, role: "ORGANIZER" },
  });
  const organizer2Profile = await prisma.organizerProfile.upsert({
    where: { userId: organizer2.id },
    update: {},
    create: {
      userId: organizer2.id,
      orgName: "Comedy Kitchen",
      about: "Stand-up shows served hot every weekend.",
      status: "PENDING",
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@demo.io" },
    update: {},
    create: { name: "Priya Customer", email: "customer@demo.io", passwordHash, role: "CUSTOMER" },
  });

  const extraCustomers = await Promise.all(
    ["Amit Verma", "Sana Khan", "Dev Patel", "Meera Nair"].map((name, i) =>
      prisma.user.upsert({
        where: { email: `fan${i + 1}@demo.io` },
        update: {},
        create: { name, email: `fan${i + 1}@demo.io`, passwordHash, role: "CUSTOMER" },
      })
    )
  );

  console.log("✓ users");

  // ── Events ─────────────────────────────────────────────────────────────
  const existingEvents = await prisma.event.count();
  if (existingEvents > 0) {
    console.log(`• ${existingEvents} events already exist — skipping event seed`);
    return;
  }

  type TierSpec = { name: string; description: string; price: number; capacity: number; soldTarget: number; perUserLimit?: number };
  type EventSpec = {
    title: string; description: string; category: string; venueName: string; city: string;
    address: string; bannerUrl: string; startsAt: Date; endsAt: Date; status: "PUBLISHED" | "DRAFT";
    pricingMode?: "STATIC" | "EARLY_BIRD" | "DEMAND"; earlyBirdEnds?: Date | null;
    organizer: typeof organizer; profileId: string; liveMode?: boolean; tiers: TierSpec[];
  };

  const eventsSpec: EventSpec[] = [
    {
      title: "Indie Nights Vol. 3 — Open Air Edition",
      description:
        "The third edition of Bengaluru's beloved indie music night, now open air!\n\n lineup:\n• 7:00 PM — Fog Lagoon\n• 8:30 PM — The Sine Waves\n• 10:00 PM — headliner: Cyan Mist\n\nFood trucks, vinyl pop-up and a sunset stage. Gates open 6:15 PM. This is a 16+ event.",
      category: "Music",
      venueName: "Fiddlesticks Arena",
      city: "Bengaluru",
      address: "Whitefield, ITPL Main Road",
      bannerUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=60",
      startsAt: daysFromNow(6, 19),
      endsAt: daysFromNow(6, 23),
      status: "PUBLISHED",
      organizer,
      profileId: organizerProfile.id,
      tiers: [
        { name: "Early Bird", description: "Limited batch — gone fast", price: 499, capacity: 150, soldTarget: 150 },
        { name: "General", description: "Regular admission", price: 799, capacity: 500, soldTarget: 312 },
        { name: "VIP", description: "Front pit + merchandise", price: 1499, capacity: 80, soldTarget: 41 },
      ],
    },
    {
      title: "DevSum 2026 — AI & Platform Engineering",
      description:
        "A full day of talks and workshops on applied AI, platform engineering and developer productivity.\n\nTracks:\n• LLMs in production\n• Data platforms at scale\n• DevEx & internal tooling\n\nIncludes lunch, swag and recordings.",
      category: "Tech",
      venueName: "KTPO Convention Centre",
      city: "Bengaluru",
      address: "Whitefield Industrial Area",
      bannerUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&q=60",
      startsAt: daysFromNow(13, 9, 30),
      endsAt: daysFromNow(13, 18),
      status: "PUBLISHED",
      pricingMode: "EARLY_BIRD",
      earlyBirdEnds: daysFromNow(5, 23, 59),
      organizer,
      profileId: organizerProfile.id,
      tiers: [
        { name: "Early Bird", description: "Ends soon — then ₹2999", price: 1999, capacity: 200, soldTarget: 87 },
        { name: "Standard", description: "Full-day pass with lunch", price: 2999, capacity: 600, soldTarget: 120 },
        { name: "Workshop Pro", description: "Pass + 2 hands-on workshops", price: 4999, capacity: 100, soldTarget: 18 },
      ],
    },
    {
      title: "Laugh Lines: Saturday Night Stand-up",
      description:
        "Four comics, ninety minutes, zero filter. This week's lineup:\n• Nishant Rao\n• Aisha Menon\n• Rohan D'Souza\n• Surprise headliner\n\n18+ only. Two drink minimum.",
      category: "Comedy",
      venueName: "The Humour Lab",
      city: "Mumbai",
      address: "Lower Parel",
      bannerUrl: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=1200&q=60",
      startsAt: daysFromNow(2, 20),
      endsAt: daysFromNow(2, 22),
      status: "PUBLISHED",
      organizer: organizer2,
      profileId: organizer2Profile.id,
      tiers: [
        { name: "Regular", description: "General seating", price: 399, capacity: 120, soldTarget: 118 },
        { name: "Front Row", description: "First two rows (risk of roasting)", price: 699, capacity: 20, soldTarget: 20 },
      ],
    },
    {
      title: "Sunburn Arena: Retro Electronix",
      description:
        "A synthwave spectacle under the stars — 5 hours of retro-futuristic electronica with live visuals, laser gardens and a retro arcade zone.",
      category: "Music",
      venueName: "Gateway Grounds",
      city: "Pune",
      address: "Agharkar Road",
      bannerUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=60",
      startsAt: daysFromNow(20, 18),
      endsAt: daysFromNow(20, 23, 30),
      status: "PUBLISHED",
      pricingMode: "DEMAND",
      organizer,
      profileId: organizerProfile.id,
      tiers: [
        { name: "Silver", description: "General standing", price: 999, capacity: 2000, soldTarget: 640, perUserLimit: 8 },
        { name: "Gold", description: "Elevated deck + bar access", price: 1999, capacity: 800, soldTarget: 201, perUserLimit: 8 },
        { name: "Platinum VIP", description: "VIP lounge, fast lane, merch pack", price: 3999, capacity: 150, soldTarget: 64, perUserLimit: 6 },
      ],
    },
    {
      title: "Marathon & Mindfulness Retreat",
      description:
        "Start the day with a 5K/10K fun run along the lakeside, followed by guided meditation, breathwork and a wellness brunch. All fitness levels welcome.",
      category: "Wellness",
      venueName: "Lakeside Promenade",
      city: "Hyderabad",
      address: "KBR Park East Gate",
      bannerUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=60",
      startsAt: daysFromNow(9, 6),
      endsAt: daysFromNow(9, 11),
      status: "PUBLISHED",
      organizer: organizer2,
      profileId: organizer2Profile.id,
      tiers: [
        { name: "Runner", description: "5K or 10K + brunch", price: 599, capacity: 300, soldTarget: 94 },
        { name: "Retreat Only", description: "Meditation & brunch, no run", price: 399, capacity: 150, soldTarget: 37 },
      ],
    },
    {
      title: "Founders Fireside: Zero to Series A",
      description:
        "An evening with three founders who scaled from bootstrapped seed rounds to Series A. Moderated Q&A, curated networking and dinner.",
      category: "Business",
      venueName: "WeWork Galaxy",
      city: "Delhi",
      address: "Connaught Place",
      bannerUrl: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&q=60",
      startsAt: daysFromNow(4, 18, 30),
      endsAt: daysFromNow(4, 21, 30),
      status: "DRAFT",
      organizer,
      profileId: organizerProfile.id,
      tiers: [
        { name: "Member", description: "Community member rate", price: 299, capacity: 80, soldTarget: 0 },
        { name: "Guest", description: "Includes dinner", price: 599, capacity: 60, soldTarget: 0 },
      ],
    },
  ];

  const createdEvents: { eventId: string; slug: string; tierIds: string[] }[] = [];

  for (const spec of eventsSpec) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const event = await prisma.event.create({
      data: {
        slug: slugify(spec.title, suffix),
        title: spec.title,
        description: spec.description,
        category: spec.category,
        bannerUrl: spec.bannerUrl,
        venueName: spec.venueName,
        city: spec.city,
        address: spec.address,
        startsAt: spec.startsAt,
        endsAt: spec.endsAt,
        status: spec.status,
        pricingMode: spec.pricingMode ?? "STATIC",
        earlyBirdEnds: spec.earlyBirdEnds ?? null,
        liveMode: spec.liveMode ?? false,
        organizerId: spec.organizer.id,
        profileId: spec.profileId,
        viewCount: Math.floor(Math.random() * 900) + 100,
        tiers: {
          create: spec.tiers.map((t, i) => ({
            name: t.name,
            description: t.description,
            pricePs: t.price * 100,
            basePricePs: t.price * 100,
            capacity: t.capacity,
            perUserLimit: t.perUserLimit ?? 6,
            dynamicFloorPs: Math.round((t.price * 100) * 0.7),
            sold: t.soldTarget,
            position: i,
          })),
        },
      },
      include: { tiers: true },
    });
    createdEvents.push({ eventId: event.id, slug: event.slug, tierIds: event.tiers.map((t) => t.id) });
  }
  console.log(`✓ ${createdEvents.length} events`);

  // ── Coupons ────────────────────────────────────────────────────────────
  await prisma.coupon.createMany({
    data: [
      { code: "WELCOME10", scope: "GLOBAL", discountType: "PERCENT", value: 10, maxDiscountPs: 30000, minOrderPs: 50000, perUserLimit: 1 },
      { code: "FLAT100", scope: "GLOBAL", discountType: "FLAT", value: 10000, minOrderPs: 80000, perUserLimit: 2 },
      {
        code: "DEVSUM15", scope: "EVENT", eventId: createdEvents[1].eventId,
        discountType: "PERCENT", value: 15, maxDiscountPs: 60000, minOrderPs: 100000, maxRedemptions: 100,
      },
      {
        code: "LAUGH50", scope: "EVENT", eventId: createdEvents[2].eventId,
        discountType: "FLAT", value: 5000, minOrderPs: 70000, maxRedemptions: 50,
      },
    ],
  });
  console.log("✓ coupons");

  // ── Demo bookings for analytics (confirmed, spread over past 20 days) ──
  const buyers = [customer, ...extraCustomers];
  const published = createdEvents.slice(0, 5);
  let bookingCount = 0;

  for (let i = 0; i < 14; i++) {
    const ev = published[i % published.length];
    const buyer = buyers[i % buyers.length];
    const qty = (i % 3) + 1;
    const pricePs = [49900, 79900, 299900, 99900][i % 4];
    const subtotal = pricePs * qty;
    const discount = i % 4 === 0 ? Math.round(subtotal * 0.1) : 0;
    const fee = Math.round((subtotal - discount) * 0.02);
    const total = subtotal - discount + fee;
    const daysAgo = 20 - i;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000 - i * 3600 * 1000);

    const reservation = await prisma.reservation.create({
      data: { tierId: ev.tierIds[1], userId: buyer.id, quantity: qty, consumed: true, expiresAt: createdAt, createdAt },
    });
    await prisma.booking.create({
      data: {
        reference: `TF-SEED${String(i + 1).padStart(3, "0")}`,
        userId: buyer.id,
        eventId: ev.eventId,
        status: "CONFIRMED",
        subtotalPs: subtotal,
        discountPs: discount,
        feePs: fee,
        totalPs: total,
        invoiceNo: `INV-2026-${String(bookingCount + 1).padStart(6, "0")}`,
        contactEmail: buyer.email,
        createdAt,
        updatedAt: createdAt,
        reservationId: reservation.id,
      },
    });
    bookingCount++;
  }
  console.log(`✓ ${bookingCount} demo bookings`);

  // ── Waitlist entry demo ────────────────────────────────────────────────
  await prisma.waitlistEntry.create({
    data: {
      eventId: createdEvents[2].eventId,
      userId: extraCustomers[0].id,
      quantity: 2,
    },
  }).catch(() => {});

  // ── Welcome notification ───────────────────────────────────────────────
  await prisma.notification.create({
    data: {
      userId: customer.id,
      kind: "SYSTEM",
      title: "Welcome to TicketFlow 🎟️",
      body: "Try a full purchase flow: open any event, grab tickets and see your QR pass.",
      link: "/browse",
    },
  });

  console.log("\n🎉 Seed complete!");
  console.log(`   admin      → admin@demo.io / ${PASSWORD}`);
  console.log(`   organizer  → organizer@demo.io / ${PASSWORD} (verified)`);
  console.log(`   organizer2 → second.organizer@demo.io / ${PASSWORD} (pending verification)`);
  console.log(`   customer   → customer@demo.io / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
