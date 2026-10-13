import { prisma } from "./prisma";
import { DEFAULT_FEE_BPS, CONVENIENCE_FEE_BPS } from "./money";

export type PlatformSettings = {
  feeBps: number;
  convenienceBps: number;
};

/**
 * Platform settings with DB overrides (admin panel) falling back to env/defaults.
 * Keys: platform_fee_bps, convenience_fee_bps
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await prisma.setting
    .findMany({
      where: { key: { in: ["platform_fee_bps", "convenience_fee_bps"] } },
    })
    .catch(() => []);
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  return {
    feeBps: map.get("platform_fee_bps") ?? DEFAULT_FEE_BPS,
    convenienceBps: map.get("convenience_fee_bps") ?? CONVENIENCE_FEE_BPS,
  };
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
