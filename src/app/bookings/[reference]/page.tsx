"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck, CalendarDays, Clock, Download, Loader2, MapPin, QrCode, Undo2,
} from "lucide-react";
import { fmtDateLong, fmtDateTime, fmtTime, prettyStatus, statusBadge } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { Spinner, Toast } from "@/components/ui";

type Detail = {
  booking: {
    id: string; reference: string; status: string; subtotalPs: number; discountPs: number;
    feePs: number; totalPs: number; invoiceNo: string | null; createdAt: string;
    contactEmail: string; refundedPs: number; holdExpiresAt: string | null;
  };
  event: {
    slug: string; title: string; startsAt: string; endsAt: string; venueName: string;
    city: string; address: string | null; bannerUrl: string | null; liveMode: boolean;
  };
  tickets: { id: string; tier: string; attendee: string | null; seat: string | null; qrPayload: string; checkedIn: boolean; checkedInAt: string | null }[];
  payment: { provider: string; method: string | null; paymentRef: string | null; amountPs: number; status: string } | null;
  gatewayMode: string;
  amounts: { subtotal: string; discount: string; fee: string; total: string };
};

export default function BookingDetailPage() {
  const { reference } = useParams<{ reference: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" | "info" } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${reference}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Not found");
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => { load(); }, [load]);

  async function refund() {
    if (!confirm("Refund this booking? Tickets will be released back to inventory.")) return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/bookings/${reference}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Customer requested" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToast({ msg: "Refund initiated — it will reflect in 5-7 business days.", tone: "success" });
      load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Refund failed", tone: "error" });
    } finally {
      setRefunding(false);
    }
  }

  if (loading) return <Spinner label="Loading booking…" />;
  if (error || !data)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="font-bold">{error || "Booking not found"}</h1>
        <Link href="/bookings" className="btn-primary mt-4">My bookings</Link>
      </div>
    );

  const { booking, event, tickets } = data;
  const isUpcoming = new Date(event.startsAt) > new Date();
  const canRefund = booking.status === "CONFIRMED" && isUpcoming;
  const eventPassed = new Date(event.endsAt) < new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      {/* Header */}
      <div className="card overflow-hidden">
        <div className="relative h-32 bg-gradient-to-br from-brand-600 to-purple-600">
          {event.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="space-y-2 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${statusBadge(booking.status)}`}>{prettyStatus(booking.status)}</span>
            {event.liveMode && <span className="badge-red">LIVE NOW</span>}
            {booking.status === "PENDING_PAYMENT" && (
              <Link href={`/checkout/${booking.reference}`} className="btn-primary ml-auto py-1.5">
                Complete payment →
              </Link>
            )}
            {canRefund && (
              <button className="btn-secondary ml-auto" onClick={refund} disabled={refunding}>
                {refunding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                Request refund
              </button>
            )}
          </div>
          <h1 className="text-xl font-extrabold">{event.title}</h1>
          <div className="grid gap-1 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
            <div><CalendarDays className="mr-1.5 inline h-4 w-4 text-brand-600" />{fmtDateLong(event.startsAt)}</div>
            <div><Clock className="mr-1.5 inline h-4 w-4 text-brand-600" />{fmtTime(event.startsAt)} – {fmtTime(event.endsAt)}</div>
            <div className="md:col-span-2"><MapPin className="mr-1.5 inline h-4 w-4 text-brand-600" />{event.venueName}, {event.city}{event.address ? ` — ${event.address}` : ""}</div>
          </div>
        </div>
      </div>

      {/* Tickets / QR wallet */}
      {booking.status === "CONFIRMED" && (
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">🎟️ Digital tickets</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">Show QR at the gate — one scan per entry</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {tickets.map((t, i) => (
              <QrTicket key={t.id} ticket={t} eventName={event.title} index={i} />
            ))}
          </div>
          {tickets.some((t) => t.checkedIn) && (
            <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-300">✓ Some tickets have been checked in at the venue.</p>
          )}
        </div>
      )}

      {booking.status === "PENDING_PAYMENT" && booking.holdExpiresAt && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ⏳ Seats held until {fmtDateTime(booking.holdExpiresAt)} — complete payment to confirm.
        </div>
      )}

      {/* Invoice */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">🧾 Invoice {booking.invoiceNo ?? ""}</h2>
          <button className="btn-secondary no-print" onClick={() => window.print()}>
            <Download className="h-4 w-4" /> Print / save PDF
          </button>
        </div>
        <div className="grid gap-x-8 gap-y-1 text-sm md:grid-cols-2">
          <div className="text-slate-500 dark:text-slate-400">Booking ref</div><div className="font-semibold">{booking.reference}</div>
          <div className="text-slate-500 dark:text-slate-400">Booked on</div><div>{fmtDateTime(booking.createdAt)}</div>
          <div className="text-slate-500 dark:text-slate-400">Contact</div><div>{booking.contactEmail}</div>
          {data.payment && (
            <>
              <div className="text-slate-500 dark:text-slate-400">Payment</div>
              <div>{data.payment.provider} · {data.payment.method ?? "—"} · {data.payment.status}</div>
              <div className="text-slate-500 dark:text-slate-400">Payment ref</div>
              <div className="break-all font-mono text-xs">{data.payment.paymentRef}</div>
            </>
          )}
        </div>
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-slate-500 dark:text-slate-400">Subtotal</span><span>{data.amounts.subtotal}</span></div>
          {booking.discountPs > 0 && <div className="flex justify-between py-0.5 text-emerald-600 dark:text-emerald-300"><span>Coupon discount</span><span>−{data.amounts.discount}</span></div>}
          <div className="flex justify-between py-0.5"><span className="text-slate-500 dark:text-slate-400">Convenience fee</span><span>{data.amounts.fee}</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-extrabold"><span>Total paid</span><span>{data.amounts.total}</span></div>
          {booking.refundedPs > 0 && (
            <div className="flex justify-between py-0.5 text-rose-600 dark:text-rose-300"><span>Refunded</span><span>−{fmtMoney(booking.refundedPs)}</span></div>
          )}
        </div>
      </div>

      {!eventPassed && booking.status === "CONFIRMED" && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Gate opens 30 min before showtime · Carry a government photo ID
        </p>
      )}
    </div>
  );
}

function QrTicket({ ticket, eventName, index }: { ticket: Detail["tickets"][number]; eventName: string; index: number }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    import("qrcode").then((QR) => {
      QR.toDataURL(ticket.qrPayload, { width: 240, margin: 1 }).then(setQr);
    });
  }, [ticket.qrPayload]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white p-3">
      <div className="shrink-0 rounded-lg bg-white p-1 shadow-card">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Ticket QR" className="h-24 w-24" />
        ) : (
          <div className="grid h-24 w-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">{ticket.tier}</div>
        <div className="truncate text-sm font-semibold">{ticket.attendee ?? `Attendee ${index + 1}`}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400">Seat {ticket.seat} · {eventName}</div>
        {ticket.checkedIn ? (
          <span className="badge-green mt-1"><BadgeCheck className="h-3 w-3" /> Checked in</span>
        ) : (
          <span className="badge-slate mt-1"><QrCode className="h-3 w-3" /> Valid pass</span>
        )}
      </div>
    </div>
  );
}
