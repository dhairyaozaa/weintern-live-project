import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fmtMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  eventId: z.string(),
  code: z.string().min(3).max(24),
  discountType: z.enum(["PERCENT", "FLAT"]),
  value: z.number().int().min(1),
  maxDiscount: z.number().min(0).optional(), // rupees
  minOrder: z.number().min(0).default(0), // rupees
  maxRedemptions: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).default(1),
  expiresAt: z.string().datetime().optional().nullable(),
});

/** Organizer: create a coupon scoped to one of my events. */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const body = createSchema.parse(await req.json());

  const event = await prisma.event.findUnique({ where: { id: body.eventId } });
  if (!event) throw new ApiError(404, "Event not found");
  if (event.organizerId !== user.id) throw new ApiError(403, "Not your event");

  const code = body.code.trim().toUpperCase();
  const exists = await prisma.coupon.findUnique({ where: { code } });
  if (exists) throw new ApiError(409, "That coupon code is taken");

  if (body.discountType === "PERCENT" && body.value > 100)
    throw new ApiError(400, "Percent discount cannot exceed 100");

  const coupon = await prisma.coupon.create({
    data: {
      code,
      scope: "EVENT",
      eventId: body.eventId,
      discountType: body.discountType,
      value: body.value,
      maxDiscountPs: body.maxDiscount ? Math.round(body.maxDiscount * 100) : null,
      minOrderPs: Math.round(body.minOrder * 100),
      maxRedemptions: body.maxRedemptions ?? null,
      perUserLimit: body.perUserLimit,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });
  await audit({
    actorId: user.id,
    action: "coupon.create",
    entity: "Coupon",
    entityId: coupon.id,
    metadata: { eventId: body.eventId, code },
  });
  return ok({
    coupon: {
      ...coupon,
      label:
        coupon.discountType === "PERCENT"
          ? `${coupon.value}% off${coupon.maxDiscountPs ? ` up to ${fmtMoney(coupon.maxDiscountPs)}` : ""}`
          : `${fmtMoney(coupon.value)} off`,
    },
  });
});

/** Organizer: list coupons for my event. */
export const GET = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) throw new ApiError(400, "Missing eventId");
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, "Event not found");
  if (event.organizerId !== user.id) throw new ApiError(403, "Not your event");

  const coupons = await prisma.coupon.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
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
      perUserLimit: c.perUserLimit,
      active: c.active,
      expiresAt: c.expiresAt,
      label:
        c.discountType === "PERCENT"
          ? `${c.value}% off${c.maxDiscountPs ? ` up to ${fmtMoney(c.maxDiscountPs)}` : ""}`
          : `${fmtMoney(c.value)} off`,
    })),
  });
});

const patchSchema = z.object({ id: z.string(), active: z.boolean() });

/** Organizer: toggle coupon active state. */
export const PATCH = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER");
  const body = patchSchema.parse(await req.json());
  const coupon = await prisma.coupon.findUnique({ where: { id: body.id } });
  if (!coupon) throw new ApiError(404, "Coupon not found");
  if (coupon.eventId) {
    const event = await prisma.event.findUnique({ where: { id: coupon.eventId } });
    if (!event || event.organizerId !== user.id) throw new ApiError(403, "Not your coupon");
  } else if (user.role !== "ADMIN") {
    throw new ApiError(403, "Global coupons are admin-managed");
  }
  const updated = await prisma.coupon.update({
    where: { id: body.id },
    data: { active: body.active },
  });
  return ok({ coupon: updated });
});
