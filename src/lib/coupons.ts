import { prisma } from "./prisma";
import { ApiError } from "./auth";

export type ValidatedCoupon = {
  id: string;
  code: string;
  discountType: "PERCENT" | "FLAT";
  value: number;
  maxDiscountPs?: number | null;
  discountPs: number;
};

/** Validate a coupon against an order context; throws ApiError with a friendly message. */
export async function validateCoupon(params: {
  code: string;
  userId: string;
  subtotalPs: number;
  eventId?: string | null;
}): Promise<ValidatedCoupon> {
  const code = params.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) throw new ApiError(400, "Invalid or inactive coupon code");
  if (coupon.expiresAt && coupon.expiresAt < new Date())
    throw new ApiError(400, "This coupon has expired");
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions)
    throw new ApiError(400, "This coupon has been fully redeemed");
  if (coupon.scope === "EVENT") {
    if (!params.eventId || coupon.eventId !== params.eventId)
      throw new ApiError(400, "This coupon is not valid for this event");
  }
  if (params.subtotalPs < coupon.minOrderPs)
    throw new ApiError(400, `Minimum order of ₹${(coupon.minOrderPs / 100).toFixed(0)} required for this coupon`);

  const used = await prisma.couponUsage.count({
    where: { couponId: coupon.id, userId: params.userId, bookingId: { not: null } },
  });
  if (used >= coupon.perUserLimit)
    throw new ApiError(400, "You have already used this coupon the maximum number of times");

  let discountPs =
    coupon.discountType === "PERCENT"
      ? Math.floor((params.subtotalPs * coupon.value) / 100)
      : Math.min(coupon.value, params.subtotalPs);
  if (coupon.maxDiscountPs) discountPs = Math.min(discountPs, coupon.maxDiscountPs);
  discountPs = Math.max(0, Math.min(discountPs, params.subtotalPs));

  return {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    value: coupon.value,
    maxDiscountPs: coupon.maxDiscountPs,
    discountPs,
  };
}

/** Record a coupon redemption once a booking is confirmed. */
export async function recordCouponUsage(params: {
  couponId: string;
  userId: string;
  bookingId: string;
}) {
  await prisma.couponUsage.create({
    data: { couponId: params.couponId, userId: params.userId, bookingId: params.bookingId },
  });
  await prisma.coupon.update({
    where: { id: params.couponId },
    data: { redemptionCount: { increment: 1 } },
  });
}
