import { prisma } from "./prisma";
import { ApiError } from "./auth";
import { consumeReservation } from "./inventory";
import { makeQrPayload, rid, invoiceNumber } from "./qr";
import { recordCouponUsage } from "./coupons";
import { notify } from "./notifications";
import { publishEventUpdate } from "./realtime";
import { fmtMoney } from "./money";

/**
 * Confirm a paid booking: consume the inventory hold, mint QR tickets,
 * assign an invoice number and notify the buyer. Idempotent.
 */
export async function confirmBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      reservation: true,
      event: { select: { id: true, title: true, slug: true, startsAt: true, venueName: true, city: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.status === "CONFIRMED") return booking; // idempotent (webhook + verify race)
  if (booking.status !== "PENDING_PAYMENT")
    throw new ApiError(409, `Booking is ${booking.status}`);

  if (!booking.reservationId || !booking.reservation)
    throw new ApiError(409, "Booking has no active reservation");

  // Move the held seats into confirmed sales. Throws if hold expired & stock resold.
  const reservation = await consumeReservation(booking.reservation.id);
  const tier = await prisma.ticketTier.findUnique({ where: { id: reservation.tierId } });
  if (!tier) throw new ApiError(500, "Tier missing for reservation");

  const seq = (await prisma.booking.count({ where: { invoiceNo: { not: null } } })) + 1;
  const invoiceNo = invoiceNumber(seq);

  // Mint tickets with signed QR payloads and seat labels.
  const existingTickets = await prisma.ticket.count({ where: { tierId: tier.id } });
  const ticketData = Array.from({ length: reservation.quantity }, (_, i) => {
    const id = rid(12);
    return {
      id,
      bookingId: booking.id,
      tierId: tier.id,
      qrPayload: makeQrPayload(id, booking.event.id),
      seatLabel: `${tier.name.slice(0, 1).toUpperCase()}-${String(existingTickets + i + 1).padStart(3, "0")}`,
    };
  });
  await prisma.ticket.createMany({ data: ticketData });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", invoiceNo },
    include: { tickets: true },
  });

  if (booking.couponId) {
    await recordCouponUsage({
      couponId: booking.couponId,
      userId: booking.userId,
      bookingId: booking.id,
    }).catch(() => {});
  }

  await notify({
    userId: booking.user.id,
    kind: "TICKET",
    title: `🎟️ ${reservation.quantity} ticket${reservation.quantity > 1 ? "s" : ""} confirmed — ${booking.event.title}`,
    body: `Booking ${booking.reference} • ${fmtMoney(booking.totalPs)} paid. Show your QR pass at ${booking.event.venueName}, ${booking.event.city}.`,
    link: `/bookings/${booking.reference}`,
  });
  await notify({
    userId: booking.userId,
    kind: "EVENT_UPDATE",
    title: `Reminder set: ${booking.event.title}`,
    body: `We'll ping you when the organizer posts updates for this event.`,
    link: `/events/${booking.event.slug}`,
  }).catch(() => {});

  publishEventUpdate(booking.event.id, { type: "inventory", soldOut: false });
  return updated;
}

/** Mark a pending booking expired (hold lapsed without payment). */
export async function expireBooking(bookingId: string) {
  await prisma.booking.updateMany({
    where: { id: bookingId, status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED" },
  });
}

/**
 * Refund a confirmed booking: gateway refund, inventory restore, notifications.
 * Allowed until event start. Idempotent.
 */
export async function refundBooking(params: {
  bookingId: string;
  actorId: string;
  reason?: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: {
      event: { select: { id: true, title: true, slug: true, startsAt: true, organizerId: true } },
      payments: true,
      refunds: true,
      reservation: true,
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.status === "REFUNDED") return { alreadyRefunded: true as const };
  if (booking.status !== "CONFIRMED")
    throw new ApiError(400, "Only confirmed bookings can be refunded");
  if (booking.event.startsAt < new Date())
    throw new ApiError(400, "Event has already started — refunds are closed");

  const captured = booking.payments.find((p) => p.status === "CAPTURED");
  if (!captured) throw new ApiError(409, "No captured payment found for this booking");

  const { gatewayRefund } = await import("./gateway");
  const { refundId } = await gatewayRefund({
    paymentRef: captured.paymentRef ?? captured.orderId ?? booking.id,
    amountPs: booking.totalPs,
  });

  const [refund] = await prisma.$transaction([
    prisma.refund.create({
      data: {
        bookingId: booking.id,
        amountPs: booking.totalPs,
        reason: params.reason,
        status: "COMPLETED",
        providerRef: refundId,
        processedBy: params.actorId,
      },
    }),
    prisma.payment.update({ where: { id: captured.id }, data: { status: "REFUNDED" } }),
    prisma.booking.update({ where: { id: booking.id }, data: { status: "REFUNDED" } }),
    ...(booking.reservationId
      ? [
          prisma.ticketTier.update({
            where: { id: booking.reservation!.tierId },
            data: { sold: { decrement: booking.reservation!.quantity } },
          }),
        ]
      : []),
  ]);

  await notify({
    userId: booking.userId,
    kind: "BOOKING",
    title: `Refund initiated — ${booking.reference}`,
    body: `₹${(booking.totalPs / 100).toFixed(2)} for “${booking.event.title}” will reflect in your account in 5-7 business days.`,
    link: `/bookings/${booking.reference}`,
  });
  publishEventUpdate(booking.event.id, { type: "inventory" });

  return { alreadyRefunded: false as const, refund };
}
