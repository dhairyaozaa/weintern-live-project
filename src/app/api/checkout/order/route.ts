import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { createGatewayOrder, gatewayMode } from "@/lib/gateway";

export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string() });

/**
 * Ensure a fresh gateway order exists for the booking and return what the
 * client needs (orderId + key for Razorpay checkout, amount for both).
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json());

  const booking = await prisma.booking.findUnique({
    where: { reference: body.reference },
    include: { reservation: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.userId !== user.id) throw new ApiError(403, "Not your booking");
  if (booking.status !== "PENDING_PAYMENT")
    throw new ApiError(409, "Booking is no longer payable");
  if (booking.reservation?.expiresAt && booking.reservation.expiresAt < new Date())
    throw new ApiError(410, "Hold expired — please book again");

  // Drop stale orders whose amount no longer matches (e.g. after coupon change).
  await prisma.payment.deleteMany({
    where: { bookingId: booking.id, status: "CREATED", amountPs: { not: booking.totalPs } },
  });

  const existing = await prisma.payment.findFirst({
    where: { bookingId: booking.id, status: "CREATED" },
  });
  if (existing?.orderId) {
    return ok({
      orderId: existing.orderId,
      amountPs: existing.amountPs,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null,
      gateway: gatewayMode(),
    });
  }

  const order = await createGatewayOrder({ bookingRef: booking.reference, amountPs: booking.totalPs });
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      provider: gatewayMode(),
      orderId: order.orderId,
      amountPs: order.amountPs,
      status: "CREATED",
    },
  });
  return ok({
    orderId: payment.orderId,
    amountPs: payment.amountPs,
    keyId: order.keyId ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null,
    gateway: gatewayMode(),
  });
});
