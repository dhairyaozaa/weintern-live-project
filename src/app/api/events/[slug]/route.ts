import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, getSessionUser } from "@/lib/auth";
import { tierAvailability } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/** Public: event detail with live tier availability. */
export const GET = handler(async (_req: Request, ctx: { params: { slug: string } }) => {
  const { slug } = ctx.params;
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: { select: { name: true } },
      profile: { select: { orgName: true, about: true, supportEmail: true, status: true } },
    },
  });
  if (!event) throw new ApiError(404, "Event not found");

  const isOwner = await (async () => {
    const session = await getSessionUser();
    if (!session) return false;
    return session.id === event.organizerId || session.role === "ADMIN";
  })();

  // Drafts/paused/rejected are only visible to the owner and admins.
  if (!isOwner && event.status !== "PUBLISHED")
    throw new ApiError(404, "Event not found");

  if (!isOwner) {
    await prisma.event.update({
      where: { id: event.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});
  }

  const availability = await tierAvailability(event.id);
  const totalCapacity = availability.reduce((s, t) => s + t.capacity, 0);
  const totalSold = availability.reduce((s, t) => s + t.sold, 0);

  return ok({
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      category: event.category,
      bannerUrl: event.bannerUrl,
      venueName: event.venueName,
      city: event.city,
      address: event.address,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: event.status,
      pricingMode: event.pricingMode,
      earlyBirdEnds: event.earlyBirdEnds,
      liveMode: event.liveMode,
      soldOut: event.soldOut,
      viewCount: event.viewCount,
      organizer: event.profile?.orgName ?? event.organizer.name,
      organizerAbout: event.profile?.about,
      supportEmail: event.profile?.supportEmail,
      verified: event.profile?.status === "VERIFIED",
    },
    tiers: availability,
    stats: {
      totalCapacity,
      totalSold,
      fillPct: totalCapacity ? Math.round((totalSold / totalCapacity) * 100) : 0,
      minPricePs: availability.length ? Math.min(...availability.map((t) => t.pricePs)) : 0,
    },
  });
});
