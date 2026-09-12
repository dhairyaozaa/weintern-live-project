import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { validateCoupon } from "@/lib/coupons";
import { getPlatformSettings } from "@/lib/settings";
import { bps } from "@/lib/money";

export const dynamic = "force-dynamic";

const schema = z.object({
  reference: z.string(),
  couponCode: z.string().nullable(),
});

/**
 * Apply (or clear) a coupon on a PENDING_PAYMENT booking and re-price it.
 * Stale CREATED payment orders are removed; a fresh one is created at pay time.
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

  const subtotalPs = booking.subtotalPs;
  const coupon = body.couponCode
    ? await validateCoupon({
        code: body.couponCode,
        userId: user.id,
        subtotalPs,
        eventId: booking.eventId,
      })
    : null;
  const discountPs = coupon?.discountPs ?? 0;
  const { convenienceBps } = await getPlatformSettings();
  const feePs = bps(subtotalPs - discountPs, convenienceBps);
  const totalPs = subtotalPs - discountPs + feePs;

  await prisma.payment.deleteMany({
    where: { bookingId: booking.id, status: "CREATED" },
  });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { couponId: coupon?.id ?? null, discountPs, feePs, totalPs },
  });

  return ok({
    booking: {
      reference: updated.reference,
      subtotalPs: updated.subtotalPs,
      discountPs: updated.discountPs,
      feePs: updated.feePs,
      totalPs: updated.totalPs,
    },
    coupon: coupon ? { code: coupon.code, discountPs } : null,
  });
});
