import { prisma } from "./prisma";
import { ApiError } from "./auth";

export const HOLD_MINUTES = 10;

/**
 * Atomically move `qty` seats from available inventory into a temporary hold.
 * Uses a single conditional UPDATE (compare-and-set on sold+heldCount) so two
 * concurrent buyers can never oversell the same seat.
 */
export async function holdTickets(params: {
  tierId: string;
  userId: string;
  quantity: number;
}) {
  const tier = await prisma.ticketTier.findUnique({
    where: { id: params.tierId },
    include: { event: true },
  });
  if (!tier) throw new ApiError(404, "Ticket tier not found");
  if (tier.event.status !== "PUBLISHED")
    throw new ApiError(400, "This event is not open for sale");
  if (params.quantity < 1) throw new ApiError(400, "Invalid quantity");
  if (params.quantity > tier.perUserLimit)
    throw new ApiError(400, `Maximum ${tier.perUserLimit} tickets per order`);

  const taken = await prisma.reservation.aggregate({
    where: { tierId: params.tierId, consumed: false, released: false, expiresAt: { gt: new Date() } },
    _sum: { quantity: true },
  });
  const heldNow = taken._sum.quantity ?? 0;
  const available = tier.capacity - tier.sold - heldNow;
  if (available < params.quantity)
    throw new ApiError(409, `Only ${Math.max(0, available)} tickets left in ${tier.name}`);

  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
  const reservation = await prisma.reservation.create({
    data: {
      tierId: params.tierId,
      userId: params.userId,
      quantity: params.quantity,
      expiresAt,
    },
  });

  const updated = await prisma.ticketTier.updateMany({
    where: { id: params.tierId, sold: { lte: tier.capacity - heldNow - params.quantity } },
    data: { heldCount: { increment: params.quantity } },
  });
  if (updated.count === 0) {
    await prisma.reservation.delete({ where: { id: reservation.id } }).catch(() => {});
    throw new ApiError(409, "Sold out while reserving — please try again");
  }
  await maybeFlipSoldOut(params.tierId);
  return reservation;
}

/** Free an active hold (explicit abandon). */
export async function releaseReservation(reservationId: string) {
  const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!r || r.consumed || r.released) return;
  await prisma.$transaction([
    prisma.ticketTier.update({
      where: { id: r.tierId },
      data: { heldCount: { decrement: r.quantity } },
    }),
    prisma.reservation.update({
      where: { id: reservationId },
      data: { released: true },
    }),
  ]);
  await maybeFlipSoldOut(r.tierId);
}

/**
 * Convert a hold into confirmed sales: increments `sold`, decrements the hold,
 * and marks the reservation consumed — inside one transaction.
 */
export async function consumeReservation(reservationId: string) {
  const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!r) throw new ApiError(404, "Reservation not found");
  if (r.consumed) return r;
  if (r.released || r.expiresAt < new Date())
    throw new ApiError(410, "Reservation hold has expired");
  await prisma.$transaction([
    prisma.ticketTier.update({
      where: { id: r.tierId },
      data: {
        sold: { increment: r.quantity },
        heldCount: { decrement: r.quantity },
      },
    }),
    prisma.reservation.update({
      where: { id: reservationId },
      data: { consumed: true },
    }),
  ]);
  await maybeFlipSoldOut(r.tierId);
  return r;
}

/** Flip event.soldOut when every tier is exhausted (or back when stock frees up). */
export async function maybeFlipSoldOut(tierId: string) {
  const tier = await prisma.ticketTier.findUnique({
    where: { id: tierId },
    include: { event: { include: { tiers: true } } },
  });
  if (!tier) return;
  const openHolds = await prisma.reservation.aggregate({
    where: { tierId, consumed: false, released: false, expiresAt: { gt: new Date() } },
    _sum: { quantity: true },
  });
  const remaining = tier.event.tiers.reduce(
    (sum, t) =>
      sum +
      (t.id === tierId
        ? t.capacity - t.sold - (openHolds._sum.quantity ?? 0)
        : t.capacity - t.sold - t.heldCount),
    0
  );
  const soldOut = remaining <= 0;
  if (soldOut !== tier.event.soldOut) {
    await prisma.event.update({
      where: { id: tier.event.id },
      data: { soldOut },
    });
    if (soldOut) {
      const { offerWaitlistSlots } = await import("./waitlist");
      await offerWaitlistSlots(tier.event.id).catch(() => {});
    }
  }
}

/** Sweep expired holds; returns count freed. Called opportunistically. */
export async function sweepExpiredReservations() {
  const expired = await prisma.reservation.findMany({
    where: { consumed: false, released: false, expiresAt: { lt: new Date() } },
    take: 100,
  });
  for (const r of expired) {
    await prisma.$transaction([
      prisma.ticketTier.update({
        where: { id: r.tierId },
        data: { heldCount: { decrement: r.quantity } },
      }),
      prisma.reservation.update({ where: { id: r.id }, data: { released: true } }),
    ]);
  }
  if (expired.length) {
    const tierIds = [...new Set(expired.map((r) => r.tierId))];
    for (const tierId of tierIds) await maybeFlipSoldOut(tierId);
  }
  return expired.length;
}

/** Live availability snapshot for an event's tiers. */
export async function tierAvailability(eventId: string) {
  const tiers = await prisma.ticketTier.findMany({
    where: { eventId },
    orderBy: { position: "asc" },
  });
  return tiers.map((t) => {
    const remaining = Math.max(0, t.capacity - t.sold - t.heldCount);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      pricePs: t.pricePs,
      basePricePs: t.basePricePs,
      capacity: t.capacity,
      sold: t.sold,
      remaining,
      perUserLimit: t.perUserLimit,
      soldOut: remaining <= 0,
      fillPct: t.capacity ? Math.round(((t.sold + t.heldCount) / t.capacity) * 100) : 0,
    };
  });
}
