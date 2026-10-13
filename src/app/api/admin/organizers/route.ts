import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Admin: list organizers with verification status and sales. */
export const GET = handler(async () => {
  await requireRole("ADMIN");
  const profiles = await prisma.organizerProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
      events: { include: { tiers: { select: { sold: true, pricePs: true } } } },
      _count: { select: { events: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return ok({
    organizers: profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      orgName: p.orgName,
      name: p.user.name,
      email: p.user.email,
      status: p.status,
      platformFeeBps: p.platformFeeBps,
      events: p._count.events,
      grossPs: p.events.reduce((s, e) => s + e.tiers.reduce((x, t) => x + t.sold * t.pricePs, 0), 0),
      joinedAt: p.user.createdAt,
    })),
  });
});

const patchSchema = z.object({
  userId: z.string(),
  action: z.enum(["verify", "reject", "pending", "setFee"]),
  feeBps: z.number().int().min(0).max(3000).optional(),
});

/** Admin: verify/reject organizer or override their commission rate. */
export const PATCH = handler(async (req: Request) => {
  const admin = await requireRole("ADMIN");
  const body = patchSchema.parse(await req.json());

  const profile = await prisma.organizerProfile.findUnique({ where: { userId: body.userId } });
  if (!profile) throw new ApiError(404, "Organizer not found");

  if (body.action === "setFee") {
    if (body.feeBps === undefined) throw new ApiError(400, "feeBps required");
    await prisma.organizerProfile.update({
      where: { id: profile.id },
      data: { platformFeeBps: body.feeBps },
    });
    await audit({
      actorId: admin.id,
      action: "organizer.fee.set",
      entity: "OrganizerProfile",
      entityId: profile.id,
      metadata: { feeBps: body.feeBps },
    });
    return ok({ success: true });
  }

  const status =
    body.action === "verify" ? "VERIFIED" : body.action === "reject" ? "REJECTED" : "PENDING";
  await prisma.organizerProfile.update({ where: { id: profile.id }, data: { status } });
  await notify({
    userId: profile.userId,
    kind: "SYSTEM",
    title:
      status === "VERIFIED"
        ? "✅ You're a verified organizer"
        : status === "REJECTED"
          ? "Organizer verification declined"
          : "Verification reset to pending",
    body:
      status === "VERIFIED"
        ? "Your events now show the verified badge — buyers see it before purchasing."
        : "Contact platform support if you believe this is a mistake.",
  });
  await audit({
    actorId: admin.id,
    action: `organizer.${body.action}`,
    entity: "OrganizerProfile",
    entityId: profile.id,
  });
  return ok({ success: true, status });
});
