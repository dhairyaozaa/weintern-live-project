import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { fmtMoney } from "@/lib/money";
import { gatewayMode } from "@/lib/gateway";

export const dynamic = "force-dynamic";

/** Booking detail: tickets with QR, invoice lines, payment and refund state. */
export const GET = handler(async (_req: Request, ctx: { params: { reference: string } }) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const booking = await prisma.booking.findUnique({
    where: { reference: ctx.params.reference },
    include: {
      event: {
        select: {
          slug: true, title: true, startsAt: true, endsAt: true,
          venueName: true, city: true, address: true, bannerUrl: true,
          organizerId: true, liveMode: true,
        },
      },
      tickets: { include: { tier: { select: { name: true } } } },
      payments: true,
      refunds: true,
      reservation: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  const isOwner = booking.userId === user.id;
  const isOrganizer = booking.event.organizerId === user.id;
  if (!isOwner && !isOrganizer && user.role !== "ADMIN")
    throw new ApiError(403, "Not your booking");

  const captured = booking.payments.find((p) => p.status === "CAPTURED" || p.status === "REFUNDED");
  const refundedPs = booking.refunds
    .filter((r) => r.status === "COMPLETED")
    .reduce((s, r) => s + r.amountPs, 0);

  return ok({
    booking: {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      subtotalPs: booking.subtotalPs,
      discountPs: booking.discountPs,
      feePs: booking.feePs,
      totalPs: booking.totalPs,
      invoiceNo: booking.invoiceNo,
      createdAt: booking.createdAt,
      contactEmail: booking.contactEmail,
      refundedPs,
      holdExpiresAt: booking.reservation?.expiresAt ?? null,
    },
    event: booking.event,
    tickets: booking.tickets.map((t) => ({
      id: t.id,
      tier: t.tier.name,
      attendee: t.attendee,
      seat: t.seatLabel,
      qrPayload: t.qrPayload,
      checkedIn: !!t.checkedInAt,
      checkedInAt: t.checkedInAt,
    })),
    payment: captured
      ? {
          provider: captured.provider,
          method: captured.method,
          paymentRef: captured.paymentRef,
          amountPs: captured.amountPs,
          status: captured.status,
        }
      : null,
    gatewayMode: gatewayMode(),
    amounts: {
      subtotal: fmtMoney(booking.subtotalPs),
      discount: fmtMoney(booking.discountPs),
      fee: fmtMoney(booking.feePs),
      total: fmtMoney(booking.totalPs),
    },
  });
});
