import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { verifyRazorpaySignature } from "@/lib/gateway";
import { confirmBooking } from "@/lib/booking";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingRef: z.string(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

/** Verify the Razorpay checkout handshake, then confirm the booking. */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json());

  const booking = await prisma.booking.findUnique({
    where: { reference: body.bookingRef },
    include: { payments: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.userId !== user.id) throw new ApiError(403, "Not your booking");
  if (booking.status !== "PENDING_PAYMENT")
    throw new ApiError(409, `Booking already ${booking.status.toLowerCase()}`);

  const payment = booking.payments.find((p) => p.orderId === body.razorpay_order_id);
  if (!payment) throw new ApiError(404, "Payment order not found for this booking");

  const valid = verifyRazorpaySignature({
    orderId: body.razorpay_order_id,
    paymentRef: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  if (!valid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: "Signature verification failed" },
    });
    throw new ApiError(400, "Payment signature verification failed");
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "CAPTURED",
      paymentRef: body.razorpay_payment_id,
      signature: body.razorpay_signature,
      method: "razorpay",
    },
  });
  const confirmed = await confirmBooking(booking.id);
  await audit({
    actorId: user.id,
    action: "payment.captured",
    entity: "Booking",
    entityId: booking.id,
    metadata: { provider: "RAZORPAY", paymentRef: body.razorpay_payment_id },
  });

  return ok({
    status: "CAPTURED",
    booking: { reference: confirmed.reference, invoiceNo: confirmed.invoiceNo },
  });
});
