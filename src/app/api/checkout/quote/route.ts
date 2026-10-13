import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { validateCoupon } from "@/lib/coupons";
import { getPlatformSettings } from "@/lib/settings";
import { bps } from "@/lib/money";
import { assertPurchaseLimit } from "@/lib/pricing";
import { sweepExpiredReservations } from "@/lib/inventory";

export const dynamic = "force-dynamic";

const schema = z.object({
  tierId: z.string(),
  quantity: z.number().int().min(1).max(50),
  couponCode: z.string().optional(),
});

/** Price a cart: tier price × qty, coupon discount, convenience fee. */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json());
  await sweepExpiredReservations().catch(() => {});

  const tier = await prisma.ticketTier.findUnique({
    where: { id: body.tierId },
    include: { event: { select: { id: true, status: true, title: true } } },
  });
  if (!tier) throw new ApiError(404, "Ticket tier not found");
  if (tier.event.status !== "PUBLISHED") throw new ApiError(400, "Event is not open for sale");

  await assertPurchaseLimit({ userId: user.id, tierId: tier.id, addingQty: body.quantity });

  const subtotalPs = tier.pricePs * body.quantity;
  const coupon = body.couponCode
    ? await validateCoupon({
        code: body.couponCode,
        userId: user.id,
        subtotalPs,
        eventId: tier.event.id,
      })
    : null;
  const discountPs = coupon?.discountPs ?? 0;
  const { convenienceBps } = await getPlatformSettings();
  const feePs = bps(subtotalPs - discountPs, convenienceBps);

  return ok({
    tier: {
      id: tier.id,
      name: tier.name,
      pricePs: tier.pricePs,
      perUserLimit: tier.perUserLimit,
      remaining: Math.max(0, tier.capacity - tier.sold - tier.heldCount),
    },
    quote: {
      subtotalPs,
      discountPs,
      feePs,
      totalPs: subtotalPs - discountPs + feePs,
    },
    coupon: coupon ? { code: coupon.code, discountPs } : null,
  });
});
