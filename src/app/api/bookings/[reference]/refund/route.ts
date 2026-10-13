import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { refundBooking } from "@/lib/booking";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ reason: z.string().max(300).optional() });

/** Customer-initiated refund request for own booking (before event start). */
export const POST = handler(async (req: Request, ctx: { params: { reference: string } }) => {
  const user = await requireRole("CUSTOMER", "ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json().catch(() => ({})));

  const booking = await prisma.booking.findUnique({
    where: { reference: ctx.params.reference },
    select: { id: true, userId: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.userId !== user.id && user.role !== "ADMIN")
    throw new ApiError(403, "Not your booking");

  const result = await refundBooking({
    bookingId: booking.id,
    actorId: user.id,
    reason: body.reason ?? "Customer requested refund",
  });
  await audit({
    actorId: user.id,
    action: "booking.refund",
    entity: "Booking",
    entityId: booking.id,
    metadata: { by: "customer" },
  });
  return ok(result);
});
