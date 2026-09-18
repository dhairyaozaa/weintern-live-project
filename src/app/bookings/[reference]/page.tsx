"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck, CalendarDays, Clock, Download, Loader2, MapPin, QrCode, Undo2,
  Receipt, ArrowLeft, ShieldCheck, CheckCircle2
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
      if (!res.ok) throw new Error(d.error || "Booking not found");
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => { load(); }, [load]);

  async function refund() {
    if (!confirm("Confirm refund request? All tickets associated with this booking will be cancelled and returned to availability.")) return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/bookings/${reference}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Customer requested" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Refund failed");
      setToast({ msg: "Refund processed successfully.", tone: "success" });
      load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Refund failed", tone: "error" });
    } finally {
      setRefunding(false);
    }
  }

  if (loading) return <Spinner label="Loading pass and booking details..." />;
  if (error || !data)
    return (
      <div className="card mx-auto max-w-md p-10 text-center bg-white border border-zinc-200/80 rounded-2xl">
        <h1 className="font-bold text-lg text-zinc-900">{error || "Booking not found"}</h1>
        <Link href="/bookings" className="btn btn-primary mt-5 text-sm">
          View All Bookings
        </Link>
      </div>
    );

  const { booking, event, tickets } = data;
  const isUpcoming = new Date(event.startsAt) > new Date();
  const canRefund = booking.status === "CONFIRMED" && isUpcoming;
  const eventPassed = new Date(event.endsAt) < new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      <div className="flex items-center gap-2 text-sm text-zinc-500 no-print">
        <Link href="/bookings" className="hover:text-zinc-900 transition flex items-center gap-1.5 font-medium">
          <ArrowLeft className="h-4 w-4" /> Bookings
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-mono font-semibold">{booking.reference}</span>
      </div>

      {/* Main Booking Summary Card */}
      <div className="card overflow-hidden bg-white border border-zinc-200/80 shadow-card rounded-3xl">
        <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-zinc-100 border-b border-zinc-100">
          {event.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.bannerUrl} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold uppercase tracking-wider text-zinc-400">
              {event.title}
            </div>
          )}
        </div>

        <div className="space-y-5 p-7 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className={`chip ${statusBadge(booking.status)} text-xs px-3 py-1`}>{prettyStatus(booking.status)}</span>
              {event.liveMode && <span className="badge-red text-xs px-2.5 py-0.5">LIVE NOW</span>}
              <span className="text-xs font-mono font-bold text-zinc-500">Order #{booking.reference}</span>
            </div>

            <div className="flex items-center gap-3 no-print">
              {booking.status === "PENDING_PAYMENT" && (
                <Link href={`/checkout/${booking.reference}`} className="btn btn-primary text-sm py-2 px-4">
                  Complete Payment
                </Link>
              )}
              {canRefund && (
                <button
                  type="button"
                  className="btn btn-secondary text-sm py-2 px-4"
                  onClick={refund}
                  disabled={refunding}
                >
                  {refunding ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Undo2 className="h-4 w-4 mr-1.5" />}
                  Request Refund
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 leading-snug">{event.title}</h1>
            <div className="grid gap-2.5 text-sm sm:text-base text-zinc-650 sm:grid-cols-2 pt-1">
              <div className="flex items-center gap-2.5">
                <CalendarDays className="h-4.5 w-4.5 text-zinc-400 shrink-0" />
                <span className="font-medium text-zinc-800">{fmtDateLong(event.startsAt)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="h-4.5 w-4.5 text-zinc-400 shrink-0" />
                <span className="font-medium text-zinc-800">{fmtTime(event.startsAt)} – {fmtTime(event.endsAt)}</span>
              </div>
              <div className="flex items-center gap-2.5 sm:col-span-2">
                <MapPin className="h-4.5 w-4.5 text-zinc-400 shrink-0" />
                <span className="font-medium text-zinc-800">{event.venueName}, {event.city}{event.address ? ` · ${event.address}` : ""}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets / QR Wallet */}
      {booking.status === "CONFIRMED" && (
        <div className="card p-7 sm:p-8 bg-white border border-zinc-200/80 shadow-sm rounded-3xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.webp" alt="TicketFlow" className="h-7 w-7 object-contain rounded-md shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                Digital Admission Passes
              </h2>
            </div>
            <span className="text-xs sm:text-sm text-zinc-500 font-medium">Present QR code at gate reader</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {tickets.map((t, i) => (
              <QrTicket key={t.id} ticket={t} eventName={event.title} index={i} />
            ))}
          </div>

          {tickets.some((t) => t.checkedIn) && (
            <div className="flex items-center gap-2.5 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>Gate scan verified: One or more passes have been checked in at venue.</span>
            </div>
          )}
        </div>
      )}

      {/* Invoice Details */}
      <div className="card p-7 sm:p-8 bg-white border border-zinc-200/80 rounded-3xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2.5">
            <Receipt className="h-5 w-5 text-zinc-900" />
            Receipt {booking.invoiceNo ? `· ${booking.invoiceNo}` : ""}
          </h2>
          <button
            type="button"
            className="btn btn-secondary text-xs sm:text-sm py-1.5 px-3.5 no-print font-semibold"
            onClick={() => window.print()}
          >
            <Download className="h-4 w-4 mr-1.5" /> Save as PDF
          </button>
        </div>

        <div className="grid gap-x-8 gap-y-2.5 text-sm sm:text-base sm:grid-cols-2 text-zinc-600">
          <div>Booking Reference</div><div className="font-mono font-bold text-zinc-900">{booking.reference}</div>
          <div>Purchased On</div><div className="text-zinc-900 font-medium">{fmtDateTime(booking.createdAt)}</div>
          <div>Contact Email</div><div className="text-zinc-900 font-medium">{booking.contactEmail}</div>
          {data.payment && (
            <>
              <div>Payment Provider</div>
              <div className="text-zinc-900 font-medium">{data.payment.provider} ({data.payment.status})</div>
              <div>Transaction Ref</div>
              <div className="break-all font-mono text-xs text-zinc-500">{data.payment.paymentRef ?? "N/A"}</div>
            </>
          )}
        </div>

        <div className="border-t border-zinc-100 pt-4 space-y-2 text-sm sm:text-base text-zinc-600">
          <div className="flex justify-between"><span>Subtotal</span><span className="text-zinc-900 font-bold">{data.amounts.subtotal}</span></div>
          {booking.discountPs > 0 && (
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>Coupon Discount</span><span>-{data.amounts.discount}</span>
            </div>
          )}
          <div className="flex justify-between"><span>Convenience Fee</span><span className="text-zinc-900 font-bold">{data.amounts.fee}</span></div>
          <div className="flex justify-between border-t border-zinc-100 pt-3 text-lg font-black text-zinc-900">
            <span>Total Paid</span><span>{data.amounts.total}</span>
          </div>
          {booking.refundedPs > 0 && (
            <div className="flex justify-between pt-1 text-rose-700 font-black">
              <span>Amount Refunded</span><span>-{fmtMoney(booking.refundedPs)}</span>
            </div>
          )}
        </div>
      </div>

      {!eventPassed && booking.status === "CONFIRMED" && (
        <p className="text-center text-xs sm:text-sm text-zinc-400 no-print font-medium">
          Gate opens 30 minutes prior to showtime · Admission requires verified QR scan
        </p>
      )}
    </div>
  );
}

function QrTicket({ ticket, eventName, index }: { ticket: Detail["tickets"][number]; eventName: string; index: number }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    import("qrcode").then((QR) => {
      QR.toDataURL(ticket.qrPayload, { width: 260, margin: 1 }).then(setQr);
    });
  }, [ticket.qrPayload]);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
      <div className="shrink-0 rounded-xl bg-white p-1.5 border border-zinc-200/80 shadow-sm">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Ticket QR Code" className="h-28 w-28" />
        ) : (
          <div className="grid h-28 w-28 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 inline-block px-2 py-0.5 rounded-md border border-brand-200/50">
          {ticket.tier}
        </div>
        <div className="truncate text-sm sm:text-base font-bold text-zinc-900">
          {ticket.attendee ?? `Pass #${index + 1}`}
        </div>
        <div className="text-xs text-zinc-500 truncate font-medium">
          {ticket.seat ? `Seat ${ticket.seat} · ` : ""}{eventName}
        </div>
        <div className="pt-1">
          {ticket.checkedIn ? (
            <span className="badge-green inline-flex items-center gap-1.5 text-xs font-semibold py-0.5 px-2">
              <BadgeCheck className="h-3.5 w-3.5" /> Checked in
            </span>
          ) : (
            <span className="badge-slate inline-flex items-center gap-1.5 text-xs font-semibold py-0.5 px-2">
              <QrCode className="h-3.5 w-3.5 text-zinc-600" /> Valid pass
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
