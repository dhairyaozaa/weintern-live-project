import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { holdTickets, sweepExpiredReservations } from "@/lib/inventory";
import { assertPurchaseLimit } from "@/lib/pricing";
import { validateCoupon } from "@/lib/coupons";
import { getPlatformSettings } from "@/lib/settings";
import { bps } from "@/lib/money";
import { bookingReference } from "@/lib/qr";
import { createGatewayOrder, gatewayMode } from "@/lib/gateway";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  tierId: z.string(),
  quantity: z.number().int().min(1).max(50),
  couponCode: z.string().optional().nullable(),
});

/**
 * Reserve tickets (10-min hold), create a PENDING_PAYMENT booking and a
 * gateway payment order. Returns checkout session details.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json());
  await sweepExpiredReservations().catch(() => {});

  const tier = await prisma.ticketTier.findUnique({
    where: { id: body.tierId },
    include: { event: { select: { id: true, slug: true, title: true, status: true } } },
  });
  if (!tier) throw new ApiError(404, "Ticket tier not found");
  if (tier.event.status !== "PUBLISHED") throw new ApiError(400, "Event is not open for sale");

  await assertPurchaseLimit({ userId: user.id, tierId: tier.id, addingQty: body.quantity });

  // 1. Atomic inventory hold
  const reservation = await holdTickets({
    tierId: tier.id,
    userId: user.id,
    quantity: body.quantity,
  });

  try {
    // 2. Price the order (fresh prices, validated coupon)
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
    const totalPs = subtotalPs - discountPs + feePs;

    // 3. Booking row
    let reference = bookingReference();
    for (let i = 0; i < 5; i++) {
      const clash = await prisma.booking.findUnique({ where: { reference } });
      if (!clash) break;
      reference = bookingReference();
    }
    const booking = await prisma.booking.create({
      data: {
        reference,
        userId: user.id,
        eventId: tier.event.id,
        status: "PENDING_PAYMENT",
        subtotalPs,
        discountPs,
        feePs,
        totalPs,
        couponId: coupon?.id,
        reservationId: reservation.id,
        contactEmail: user.email,
      },
    });

    // 4. Gateway order
    const order = await createGatewayOrder({ bookingRef: reference, amountPs: totalPs });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: gatewayMode(),
        orderId: order.orderId,
        amountPs: totalPs,
        status: "CREATED",
      },
    });

    await audit({
      actorId: user.id,
      action: "booking.reserved",
      entity: "Booking",
      entityId: booking.id,
      metadata: { eventId: tier.event.id, qty: body.quantity, totalPs },
    });

    return ok({
      booking: { id: booking.id, reference, totalPs, expiresAt: reservation.expiresAt },
      tier: { id: tier.id, name: tier.name, pricePs: tier.pricePs, quantity: body.quantity },
      event: { slug: tier.event.slug, title: tier.event.title },
      payment: {
        id: payment.id,
        orderId: order.orderId,
        amountPs: totalPs,
        gateway: gatewayMode(),
        keyId: order.keyId ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null,
      },
      holdMinutes: Math.round((reservation.expiresAt.getTime() - Date.now()) / 60000),
    });
  } catch (err) {
    // Release the hold if anything downstream failed.
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { released: true },
    }).catch(() => {});
    await prisma.ticketTier.update({
      where: { id: tier.id },
      data: { heldCount: { decrement: body.quantity } },
    }).catch(() => {});
    throw err;
  }
});
