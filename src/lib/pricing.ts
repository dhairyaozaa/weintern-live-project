import { prisma } from "./prisma";
import { ApiError } from "./auth";
import { bps } from "./money";
import { getPlatformSettings } from "./settings";

/**
 * Apply early-bird / demand pricing to an event.
 *  - EARLY_BIRD: after `earlyBirdEnds`, tiers step up to basePrice.
 *  - DEMAND: organizer can push a new price, never below dynamicFloor.
 * Returns count of tiers adjusted.
 */
export async function applyPricingRules(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tiers: true },
  });
  if (!event) return 0;

  let changed = 0;
  if (event.pricingMode === "EARLY_BIRD" && event.earlyBirdEnds) {
    const ended = event.earlyBirdEnds < new Date();
    if (ended) {
      for (const tier of event.tiers) {
        if (tier.pricePs < tier.basePricePs) {
          await prisma.ticketTier.update({
            where: { id: tier.id },
            data: { pricePs: tier.basePricePs },
          });
          changed++;
        }
      }
    }
  }
  return changed;
}

/** Commission basis points for an event: organizer override → setting → env default. */
export async function organizerFeeBps(eventId: string): Promise<number> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { profile: { select: { platformFeeBps: true } } },
  });
  if (event?.profile?.platformFeeBps != null) return event.profile.platformFeeBps;
  const settings = await getPlatformSettings();
  return settings.feeBps;
}

/** Commission the platform earns on a confirmed booking. */
export function platformCommissionPs(subtotalAfterDiscountPs: number, feeBps: number) {
  return bps(subtotalAfterDiscountPs, feeBps);
}

/** Validate per-user purchase limit across bookings for this event+tier. */
export async function assertPurchaseLimit(params: {
  userId: string;
  tierId: string;
  addingQty: number;
}) {
  const tier = await prisma.ticketTier.findUnique({ where: { id: params.tierId } });
  if (!tier) throw new ApiError(404, "Tier not found");
  if (tier.perUserLimit <= 0) return;
  const agg = await prisma.ticket.aggregate({
    where: {
      tierId: params.tierId,
      booking: { userId: params.userId, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] } },
    },
    _count: true,
  });
  if (agg._count + params.addingQty > tier.perUserLimit) {
    throw new ApiError(400, `Limit ${tier.perUserLimit} tickets per person for ${tier.name}`);
  }
}
