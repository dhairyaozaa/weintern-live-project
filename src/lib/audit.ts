import { prisma } from "./prisma";

/** Append an audit trail entry. Never throws into the request path. */
export async function audit(params: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
