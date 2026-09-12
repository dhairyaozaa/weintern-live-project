import { prisma } from "@/lib/prisma";
import { ok, handler, pageParams } from "@/lib/api";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Customer: list my bookings (summary cards). */
export const GET = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const { take, skip, page } = pageParams(req);
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        event: { select: { slug: true, title: true, startsAt: true, city: true, venueName: true, bannerUrl: true, status: true, liveMode: true } },
        tickets: { include: { tier: { select: { name: true } } } },
        refunds: true,
      },
    }),
    prisma.booking.count({ where: { userId: user.id } }),
  ]);

  return ok({
    total,
    page,
    bookings: bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
      totalPs: b.totalPs,
      subtotalPs: b.subtotalPs,
      discountPs: b.discountPs,
      feePs: b.feePs,
      invoiceNo: b.invoiceNo,
      createdAt: b.createdAt,
      event: b.event,
      tickets: b.tickets.map((t) => ({
        id: t.id,
        tier: t.tier.name,
        attendee: t.attendee,
        seat: t.seatLabel,
        checkedIn: !!t.checkedInAt,
      })),
      refunded: b.refunds.some((r) => r.status === "COMPLETED"),
    })),
  });
});
