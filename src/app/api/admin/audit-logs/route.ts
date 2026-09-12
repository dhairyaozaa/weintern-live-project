import { prisma } from "@/lib/prisma";
import { ok, handler, pageParams } from "@/lib/api";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin: paginated audit trail. */
export const GET = handler(async (req: Request) => {
  await requireRole("ADMIN");
  const { take, skip, page } = pageParams(req, 50);
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const where = action ? { action: { contains: action } } : {};
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { actor: { select: { name: true, email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return ok({
    total,
    page,
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      metadata: l.metadata,
      actor: l.actor ? { name: l.actor.name, email: l.actor.email, role: l.actor.role } : null,
      createdAt: l.createdAt,
    })),
  });
});
