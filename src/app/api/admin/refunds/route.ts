import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";
import { refundBooking } from "@/lib/booking";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({ bookingRef: z.string(), reason: z.string().max(300).optional() });

/** Admin: force refund any confirmed booking by reference. */
export const POST = handler(async (req: Request) => {
  const admin = await requireRole("ADMIN");
  const body = schema.parse(await req.json());
  const booking = await prisma.booking.findUnique({
    where: { reference: body.bookingRef },
    select: { id: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");

  const result = await refundBooking({
    bookingId: booking.id,
    actorId: admin.id,
    reason: body.reason ?? "Admin-issued refund",
  });
  await audit({
    actorId: admin.id,
    action: "booking.refund",
    entity: "Booking",
    entityId: booking.id,
    metadata: { by: "admin" },
  });
  return ok(result);
});
