import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await getSessionUser();
  if (!session) return ok({ user: null });
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { organizerProfile: true },
  });
  if (!user) return ok({ user: null });
  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizer: user.organizerProfile
        ? {
            orgName: user.organizerProfile.orgName,
            status: user.organizerProfile.status,
            platformFeeBps: user.organizerProfile.platformFeeBps,
          }
        : null,
    },
    unread,
  });
});
