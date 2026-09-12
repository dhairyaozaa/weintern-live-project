import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler, pageParams } from "@/lib/api";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ ids: z.array(z.string()).optional() });

/** List my notifications (newest first). */
export const GET = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const { take, skip } = pageParams(req, 30);
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return ok({ notifications, unread });
});

/** Mark notifications read (all, or specific ids). */
export const PATCH = handler(async (req: Request) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json().catch(() => ({})));
  await prisma.notification.updateMany({
    where: { userId: user.id, ...(body.ids ? { id: { in: body.ids } } : {}), readAt: null },
    data: { readAt: new Date() },
  });
  return ok({ success: true });
});
