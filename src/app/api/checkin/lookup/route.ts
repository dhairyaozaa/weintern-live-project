import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ query: z.string().min(3) });

/** Manual lookup by booking reference / email / seat label (gate fallback). */
export const POST = handler(async (req: Request) => {
  const user = await requireRole("ORGANIZER", "ADMIN");
  const body = schema.parse(await req.json());
  const q = body.query.trim();

  const tickets = await prisma.ticket.findMany({
    where: {
      booking: {
        event: { organizerId: user.id },
        OR: [
          { reference: { equals: q, mode: "insensitive" } },
          { user: { email: { equals: q, mode: "insensitive" } } },
          { user: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
    },
    include: {
      tier: { select: { name: true } },
      booking: {
        select: {
          reference: true, status: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
    take: 20,
  });
  if (!tickets.length) throw new ApiError(404, "No tickets found for that query");

  return ok({
    tickets: tickets.map((t) => ({
      qrPayload: t.qrPayload,
      attendee: t.attendee ?? t.booking.user.name,
      email: t.booking.user.email,
      bookingRef: t.booking.reference,
      bookingStatus: t.booking.status,
      tier: t.tier.name,
      seat: t.seatLabel,
      checkedIn: !!t.checkedInAt,
    })),
  });
});
