import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const bookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED" },
    orderBy: { updatedAt: "desc" },
    take: 12,
    include: {
      event: { select: { title: true, slug: true } },
      user: { select: { name: true } },
    },
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      name: b.user?.name?.split(" ")[0] ?? "Someone",
      title: b.event.title,
      slug: b.event.slug,
      at: b.updatedAt,
    })),
  });
}
