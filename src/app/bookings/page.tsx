"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, QrCode, ChevronRight, ArrowLeft } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { prettyStatus, statusBadge } from "@/lib/format";
import { EmptyState, Spinner } from "@/components/ui";

type Booking = {
  id: string;
  reference: string;
  status: string;
  totalPs: number;
  invoiceNo: string | null;
  createdAt: string;
  event: { slug: string; title: string; startsAt: string; city: string; venueName: string; bannerUrl: string | null; status: string; liveMode: boolean };
  tickets: { tier: string; seat?: string | null }[];
  refunded: boolean;
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bookings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading your bookings..." />;

  const upcoming = bookings.filter((b) => new Date(b.event.startsAt) >= new Date() && b.status === "CONFIRMED");
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-zinc-200/80 pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">My Bookings</h1>
          <p className="text-sm sm:text-base text-zinc-500 mt-1">Your tickets, QR passes, and payment receipts</p>
        </div>
        <Link href="/browse" className="btn btn-secondary text-sm font-semibold">
          Explore Events
        </Link>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          body="You have not reserved or purchased any tickets yet. Explore upcoming events to get your digital pass."
          action={<Link href="/browse" className="btn btn-primary text-sm font-semibold">Browse Events</Link>}
        />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Upcoming Events</h2>
              <div className="space-y-3.5">
                {upcoming.map((b) => <BookingCard key={b.id} b={b} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Past & Completed</h2>
              <div className="space-y-3.5">
                {past.map((b) => <BookingCard key={b.id} b={b} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function BookingCard({ b }: { b: Booking }) {
  return (
    <Link
      href={`/bookings/${b.reference}`}
      className="card flex items-center justify-between gap-5 p-5 bg-white border border-zinc-200/80 hover:border-zinc-400 hover:shadow-sm transition duration-150 rounded-2xl"
    >
      <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-100 border border-zinc-200/60 sm:block">
        {b.event.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.event.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <QrCode className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`chip ${statusBadge(b.status)} text-xs px-2.5 py-0.5`}>{prettyStatus(b.status)}</span>
          {b.event.liveMode && <span className="badge-red text-xs px-2 py-0.5">LIVE</span>}
          {b.refunded && <span className="badge-slate text-xs px-2 py-0.5">Refund Issued</span>}
          <span className="text-xs font-mono text-zinc-400">Ref: {b.reference}</span>
        </div>

        <div className="truncate text-base sm:text-lg font-bold text-zinc-900">{b.event.title}</div>

        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <CalendarDays className="h-4 w-4 text-zinc-400 shrink-0" />
          <span>{fmtDateTime(b.event.startsAt)} · {b.event.venueName}, {b.event.city}</span>
        </div>

        <div className="flex items-center gap-4 text-sm pt-1">
          <span className="text-zinc-700 font-medium">
            {b.tickets.length} {b.tickets.length > 1 ? "tickets" : "ticket"}
          </span>
          <span className="font-black text-zinc-900 text-base">{fmtMoney(b.totalPs)}</span>
          <span className="flex items-center gap-1.5 text-zinc-800 font-semibold bg-zinc-100 px-2.5 py-1 rounded-lg text-xs">
            <QrCode className="h-3.5 w-3.5 text-zinc-700" /> Digital QR Pass
          </span>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 text-zinc-400 shrink-0" />
    </Link>
  );
}
