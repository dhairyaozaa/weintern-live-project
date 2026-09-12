"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, QrCode } from "lucide-react";
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

  if (loading) return <Spinner label="Loading your bookings…" />;

  const upcoming = bookings.filter((b) => new Date(b.event.startsAt) >= new Date() && b.status === "CONFIRMED");
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">My bookings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your tickets, QR passes and invoices</p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          body="Browse events and your booked tickets will appear here with QR passes."
          action={<Link href="/browse" className="btn-primary">Browse events</Link>}
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Upcoming</h2>
              {upcoming.map((b) => <BookingCard key={b.id} b={b} />)}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">History</h2>
              {past.map((b) => <BookingCard key={b.id} b={b} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BookingCard({ b }: { b: Booking }) {
  return (
    <Link href={`/bookings/${b.reference}`} className="card flex items-center gap-4 p-4 transition hover:shadow-card">
      <div className="hidden h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 sm:block">
        {b.event.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.event.bannerUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${statusBadge(b.status)}`}>{prettyStatus(b.status)}</span>
          {b.event.liveMode && <span className="badge-red">LIVE</span>}
          {b.refunded && <span className="badge-slate">refund issued</span>}
        </div>
        <div className="mt-1 truncate font-bold">{b.event.title}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
          {fmtDateTime(b.event.startsAt)} · {b.event.venueName}, {b.event.city}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{b.tickets.length} ticket{b.tickets.length > 1 ? "s" : ""}</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{fmtMoney(b.totalPs)}</span>
          <span className="flex items-center gap-1 text-brand-700 dark:text-brand-300"><QrCode className="h-3.5 w-3.5" /> QR pass</span>
        </div>
      </div>
      <div className="text-slate-300">›</div>
    </Link>
  );
}
