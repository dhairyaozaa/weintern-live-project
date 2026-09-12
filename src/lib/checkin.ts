import { prisma } from "./prisma";
import { ApiError } from "./auth";
import { parseQrPayload } from "./qr";

/**
 * Verify and check in a QR ticket at the gate.
 * Idempotent: re-scanning returns the ticket's previous check-in info.
 */
export async function verifyAndCheckIn(params: {
  payload: string;
  scannerId: string;
  force?: boolean;
}) {
  const parsed = parseQrPayload(params.payload);
  if (!parsed) throw new ApiError(400, "Invalid QR code");

  const ticket = await prisma.ticket.findUnique({
    where: { qrPayload: params.payload.trim() },
    include: {
      tier: { select: { name: true } },
      booking: {
        include: {
          user: { select: { name: true, email: true } },
          event: { select: { id: true, title: true, organizerId: true, status: true, liveMode: true } },
        },
      },
    },
  });
  if (!ticket) throw new ApiError(404, "Ticket not found — possible forgery");
  if (ticket.booking.event.organizerId !== params.scannerId)
    throw new ApiError(403, "This ticket belongs to another organizer's event");
  if (ticket.booking.status !== "CONFIRMED")
    throw new ApiError(400, `Booking is ${ticket.booking.status.replace("_", " ").toLowerCase()}`);

  if (ticket.checkedInAt) {
    if (!params.force)
      return {
        alreadyCheckedIn: true as const,
        checkedInAt: ticket.checkedInAt,
        attendee: ticket.attendee ?? ticket.booking.user.name,
        tier: ticket.tier.name,
        seat: ticket.seatLabel,
      };
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { checkedInAt: new Date(), checkedInBy: params.scannerId },
  });

  return {
    alreadyCheckedIn: false as const,
    checkedInAt: updated.checkedInAt,
    attendee: ticket.attendee ?? ticket.booking.user.name,
    tier: ticket.tier.name,
    seat: ticket.seatLabel,
  };
}
