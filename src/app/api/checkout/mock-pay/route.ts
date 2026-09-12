import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { captureMockPayment, createGatewayOrder, gatewayMode, mockSignature } from "@/lib/gateway";
import { confirmBooking, expireBooking } from "@/lib/booking";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingRef: z.string(),
  simulateFailure: z.boolean().optional(),
});

/**
 * MOCK gateway: simulate the bank capture for a booking. Mirrors what the
 * Razorpay verify/webhook path does so switching modes changes nothing else.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  if (gatewayMode() !== "MOCK")
    throw new ApiError(400, "Mock payments are disabled when GATEWAY_MODE=RAZORPAY");

  const body = schema.parse(await req.json());
  const booking = await prisma.booking.findUnique({
    where: { reference: body.bookingRef },
    include: { payments: true, reservation: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.userId !== user.id) throw new ApiError(403, "Not your booking");
  if (booking.status !== "PENDING_PAYMENT")
    throw new ApiError(409, `Booking already ${booking.status.toLowerCase()}`);

  const holdExpired = booking.reservation?.expiresAt && booking.reservation.expiresAt < new Date();
  if (holdExpired) {
    await expireBooking(booking.id);
    throw new ApiError(410, "Reservation hold expired — please book again");
  }

  // Find a live CREATED order matching the current total, or create one now.
  // (apply-coupon deletes stale CREATED orders — a fresh one is (re)created at
  // pay time so MOCK mode works even after coupon changes.)
  let payment = booking.payments.find(
    (p) => p.status === "CREATED" && p.amountPs === booking.totalPs
  );
  if (!payment) {
    await prisma.payment.deleteMany({
      where: { bookingId: booking.id, status: "CREATED" },
    });
    const order = await createGatewayOrder({
      bookingRef: booking.reference,
      amountPs: booking.totalPs,
    });
    payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: gatewayMode(),
        orderId: order.orderId,
        amountPs: booking.totalPs,
        status: "CREATED",
      },
    });
  }
  if (!payment?.orderId) throw new ApiError(409, "Could not create payment order");

  const result = await captureMockPayment({
    orderId: payment.orderId,
    amountPs: payment.amountPs,
    simulateFailure: body.simulateFailure,
  });

  if (result.status === "FAILED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        paymentRef: result.paymentRef,
        method: result.method,
        failureReason: result.failureReason,
      },
    });
    await audit({
      actorId: user.id,
      action: "payment.failed",
      entity: "Booking",
      entityId: booking.id,
      metadata: { reason: result.failureReason },
    });
    return ok({ status: "FAILED", reason: result.failureReason });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "CAPTURED",
      paymentRef: result.paymentRef,
      method: result.method,
      signature: mockSignature(payment.orderId, result.paymentRef),
    },
  });
  const confirmed = await confirmBooking(booking.id);
  await audit({
    actorId: user.id,
    action: "payment.captured",
    entity: "Booking",
    entityId: booking.id,
    metadata: { provider: "MOCK", paymentRef: result.paymentRef },
  });

  return ok({
    status: "CAPTURED",
    booking: { reference: confirmed.reference, invoiceNo: confirmed.invoiceNo },
  });
});
