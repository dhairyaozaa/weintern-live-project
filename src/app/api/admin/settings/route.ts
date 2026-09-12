import { z } from "zod";
import { ok, handler } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getPlatformSettings, setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Admin: get platform settings. */
export const GET = handler(async () => {
  await requireRole("ADMIN");
  return ok({ settings: await getPlatformSettings() });
});

const schema = z.object({
  feeBps: z.number().int().min(0).max(3000).optional(),
  convenienceBps: z.number().int().min(0).max(3000).optional(),
});

/** Admin: update commission / convenience fee. */
export const PATCH = handler(async (req: Request) => {
  const admin = await requireRole("ADMIN");
  const body = schema.parse(await req.json());
  if (body.feeBps !== undefined) await setSetting("platform_fee_bps", String(body.feeBps));
  if (body.convenienceBps !== undefined)
    await setSetting("convenience_fee_bps", String(body.convenienceBps));
  await audit({ actorId: admin.id, action: "settings.update", entity: "Setting", metadata: body });
  return ok({ settings: await getPlatformSettings() });
});
