import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  orgName: z.string().min(2).max(120).optional(),
  about: z.string().max(600).optional(),
  supportEmail: z.string().email().optional(),
  supportPhone: z.string().max(20).optional(),
  upiId: z.string().max(80).optional(),
});

/** Organizer: my profile (org info + verification status). */
export const GET = handler(async () => {
  const user = await requireRole("ORGANIZER");
  const profile = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
    include: { _count: { select: { events: true } } },
  });
  if (!profile) return ok({ profile: null });

  const events = await prisma.event.findMany({
    where: { organizerId: user.id },
    include: { tiers: { select: { sold: true, pricePs: true } } },
  });
  const grossPs = events.reduce(
    (s, e) => s + e.tiers.reduce((x, t) => x + t.sold * t.pricePs, 0),
    0
  );
  return ok({
    profile: {
      orgName: profile.orgName,
      about: profile.about,
      supportEmail: profile.supportEmail,
      supportPhone: profile.supportPhone,
      upiId: profile.upiId,
      status: profile.status,
      platformFeeBps: profile.platformFeeBps,
      events: profile._count.events,
      grossPs,
    },
  });
});

/** Organizer: update profile. */
export const PATCH = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const body = schema.parse(await req.json());
  const profile = await prisma.organizerProfile.update({
    where: { userId: user.id },
    data: {
      ...(body.orgName ? { orgName: body.orgName } : {}),
      ...(body.about !== undefined ? { about: body.about } : {}),
      ...(body.supportEmail !== undefined ? { supportEmail: body.supportEmail } : {}),
      ...(body.supportPhone !== undefined ? { supportPhone: body.supportPhone } : {}),
      ...(body.upiId !== undefined ? { upiId: body.upiId } : {}),
    },
  });
  await audit({ actorId: user.id, action: "organizer.profile.update", entity: "OrganizerProfile", entityId: profile.id });
  return ok({ profile });
});
