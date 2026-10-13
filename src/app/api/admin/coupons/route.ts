import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fmtMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  code: z.string().min(3).max(24),
  discountType: z.enum(["PERCENT", "FLAT"]),
  value: z.number().int().min(1),
  maxDiscount: z.number().min(0).optional(),
  minOrder: z.number().min(0).default(0),
  maxRedemptions: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).default(1),
  expiresAt: z.string().datetime().optional().nullable(),
});

/** Admin: create a platform-wide coupon. */
export const POST = handler(async (req: Request) => {
  const admin = await requireRole("ADMIN");
  const body = createSchema.parse(await req.json());
  const code = body.code.trim().toUpperCase();
  const exists = await prisma.coupon.findUnique({ where: { code } });
  if (exists) throw new ApiError(409, "That coupon code is taken");
  if (body.discountType === "PERCENT" && body.value > 100)
    throw new ApiError(400, "Percent discount cannot exceed 100");

  const coupon = await prisma.coupon.create({
    data: {
      code,
      scope: "GLOBAL",
      discountType: body.discountType,
      value: body.value,
      maxDiscountPs: body.maxDiscount ? Math.round(body.maxDiscount * 100) : null,
      minOrderPs: Math.round(body.minOrder * 100),
      maxRedemptions: body.maxRedemptions ?? null,
      perUserLimit: body.perUserLimit,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });
  await audit({ actorId: admin.id, action: "coupon.global.create", entity: "Coupon", entityId: coupon.id, metadata: { code } });
  return ok({ coupon });
});

/** Admin: list global coupons. */
export const GET = handler(async () => {
  await requireRole("ADMIN");
  const coupons = await prisma.coupon.findMany({
    where: { scope: "GLOBAL" },
    orderBy: { createdAt: "desc" },
    include: { event: { select: { title: true } } },
  });
  return ok({
    coupons: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      discountType: c.discountType,
      value: c.value,
      maxDiscountPs: c.maxDiscountPs,
      minOrderPs: c.minOrderPs,
      redemptionCount: c.redemptionCount,
      maxRedemptions: c.maxRedemptions,
      active: c.active,
      expiresAt: c.expiresAt,
      label:
        c.discountType === "PERCENT"
          ? `${c.value}% off${c.maxDiscountPs ? ` up to ${fmtMoney(c.maxDiscountPs)}` : ""}`
          : `${fmtMoney(c.value)} off`,
    })),
  });
});

/** Admin: toggle coupon. */
export const PATCH = handler(async (req: Request) => {
  const admin = await requireRole("ADMIN");
  const body = z.object({ id: z.string(), active: z.boolean() }).parse(await req.json());
  const coupon = await prisma.coupon.update({
    where: { id: body.id },
    data: { active: body.active },
  });
  await audit({ actorId: admin.id, action: "coupon.toggle", entity: "Coupon", entityId: coupon.id, metadata: { active: body.active } });
  return ok({ coupon });
});
