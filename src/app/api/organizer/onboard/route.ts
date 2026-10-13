import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, createSession, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const schema = z.object({
  orgName: z.string().min(2).max(120),
  about: z.string().max(600).optional(),
  supportEmail: z.string().email().optional(),
  supportPhone: z.string().max(20).optional(),
});

/** Upgrade the signed-in account to an organizer (starts unverified). */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER");
  const body = schema.parse(await req.json());

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "ORGANIZER",
      organizerProfile: {
        create: {
          orgName: body.orgName,
          about: body.about,
          supportEmail: body.supportEmail,
          supportPhone: body.supportPhone,
          status: "PENDING",
        },
      },
    },
    include: { organizerProfile: true },
  });

  // Session JWT carries the role — re-issue with ORGANIZER.
  await createSession({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
  });
  await notify({
    userId: updated.id,
    kind: "SYSTEM",
    title: "Organizer account created",
    body: "Complete your event setup. Verification unlocks the verified badge on your events.",
  });
  await audit({
    actorId: user.id,
    action: "organizer.onboard",
    entity: "OrganizerProfile",
    entityId: updated.organizerProfile!.id,
    metadata: { orgName: body.orgName },
  });
  return ok({ organizer: updated.organizerProfile });
});
