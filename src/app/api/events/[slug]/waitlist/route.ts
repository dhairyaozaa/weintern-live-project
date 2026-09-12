import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { joinWaitlist } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

const schema = z.object({ quantity: z.number().int().min(1).max(10).default(2) });

/** Join the waitlist for a sold-out event. */
export const POST = handler(async (req: Request, ctx: { params: { slug: string } }) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json().catch(() => ({})));

  const event = await prisma.event.findUnique({ where: { slug: ctx.params.slug } });
  if (!event) throw new ApiError(404, "Event not found");

  const result = await joinWaitlist({
    eventId: event.id,
    userId: user.id,
    quantity: body.quantity,
  });
  if (!result.ok) throw new ApiError(400, result.error);
  return ok({ joined: true, position: result.position });
});

/** Leave the waitlist. */
export const DELETE = handler(async (_req: Request, ctx: { params: { slug: string } }) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const event = await prisma.event.findUnique({ where: { slug: ctx.params.slug } });
  if (!event) throw new ApiError(404, "Event not found");
  await prisma.waitlistEntry.deleteMany({
    where: { eventId: event.id, userId: user.id },
  });
  return ok({ joined: false });
});

/** Am I on the waitlist? */
export const GET = handler(async (_req: Request, ctx: { params: { slug: string } }) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const event = await prisma.event.findUnique({ where: { slug: ctx.params.slug } });
  if (!event) throw new ApiError(404, "Event not found");
  const entry = await prisma.waitlistEntry.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
  });
  return ok({ joined: !!entry, notified: !!entry?.notifiedAt });
});
