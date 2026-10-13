"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCard, Loader2, Timer, Wallet, X, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { countdown } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { Spinner, Toast } from "@/components/ui";

type BookingDetail = {
  booking: {
    reference: string; status: string; subtotalPs: number; discountPs: number;
    feePs: number; totalPs: number; holdExpiresAt: string | null;
  };
  event: { slug: string; title: string; startsAt: string; venueName: string; city: string };
  tickets: { tier: string }[];
  gatewayMode: string;
};

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void }; }
}

export default function CheckoutPage() {
  const { reference } = useParams<{ reference: string }>();
  const router = useRouter();
  const [data, setData] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" | "info" } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(600);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${reference}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Booking not found");
      setData(d);
      if (d.booking.status === "CONFIRMED") {
        router.replace(`/bookings/${reference}`);
        return;
      }
      if (d.booking.status === "EXPIRED") setError("Your 10-minute hold expired. Please book again.");
      if (d.booking.holdExpiresAt) {
        setSecondsLeft(Math.max(0, Math.floor((new Date(d.booking.holdExpiresAt).getTime() - Date.now()) / 1000)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [reference, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function applyCoupon(code: string | null) {
    try {
      const res = await fetch("/api/checkout/apply-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, couponCode: code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Coupon failed");
      setAppliedCoupon(d.coupon?.code ?? null);
      setData((prev) =>
        prev ? { ...prev, booking: { ...prev.booking, ...d.booking } } : prev
      );
      if (d.coupon) setToast({ msg: `${d.coupon.code} applied — you save ${fmtMoney(d.coupon.discountPs)}!`, tone: "success" });
      else setToast({ msg: "Coupon removed", tone: "info" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Coupon failed", tone: "error" });
    }
  }

  async function pay() {
    setPaying(true);
    setToast(null);
    try {
      if (data!.gatewayMode === "RAZORPAY") {
        if (!window.Razorpay) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://checkout.razorpay.com/v1/checkout.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
            document.body.appendChild(s);
          });
        }
        const order = await fetch("/api/checkout/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        }).then((r) => r.json());
        if (order.error) throw new Error(order.error);

        if (window.Razorpay) {
          const rzp = new window.Razorpay({
            key: order.keyId,
            amount: order.amountPs,
            currency: "INR",
            name: "TicketFlow",
            image: "/logo.webp",
            description: data!.event.title,
            order_id: order.orderId,
            handler: async (response: Record<string, string>) => {
              const verify = await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingRef: reference, ...response }),
              });
              const d = await verify.json();
              if (!verify.ok) throw new Error(d.error);
              router.push(`/bookings/${reference}?justPaid=1`);
            },
            theme: { color: "#18181b" },
          });
          rzp.open();
        } else {
          throw new Error("Razorpay failed to load");
        }
      } else {
        const res = await fetch("/api/checkout/mock-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingRef: reference }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Payment failed");
        if (d.status === "FAILED") throw new Error(d.reason || "Payment declined");
        router.push(`/bookings/${reference}?justPaid=1`);
      }
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Payment failed", tone: "error" });
      load();
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <Spinner label="Loading checkout..." />;
  if (error || !data)
    return (
      <div className="card mx-auto max-w-md space-y-4 p-10 text-center bg-white border border-zinc-200/80 rounded-2xl">
        <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
        <h1 className="text-lg font-bold text-zinc-900">{error || "Checkout unavailable"}</h1>
        <Link href="/browse" className="btn btn-primary text-sm mt-2">Browse Events</Link>
      </div>
    );

  const total = data.booking.totalPs;

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      {/* Header Info */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border border-zinc-200/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="TicketFlow" className="h-12 w-12 object-contain rounded-xl shadow-xs shrink-0 hidden sm:block" />
          <div className="space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Complete Reservation</div>
            <h1 className="text-lg sm:text-xl font-extrabold text-zinc-900 leading-snug">{data.event.title}</h1>
          <div className="text-sm text-zinc-600 font-medium">
            {data.tickets.length} × {data.tickets[0]?.tier} pass
          </div>
        </div>
      </div>

        <div className={`chip self-start sm:self-center border px-3.5 py-1.5 font-mono text-sm font-bold ${
          secondsLeft < 120
            ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
            : "bg-amber-50 text-amber-800 border-amber-200"
        }`}>
          <Timer className="h-4 w-4 mr-1.5 shrink-0" />
          <span>Hold expires: {countdown(secondsLeft)}</span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="card space-y-3.5 p-6 bg-white border border-zinc-200/80 rounded-2xl shadow-sm text-sm sm:text-base">
        <div className="font-extrabold text-base sm:text-lg text-zinc-900 border-b border-zinc-100 pb-3">Order Summary</div>
        <div className="flex justify-between text-zinc-600 pt-1">
          <span>Tickets Subtotal</span>
          <span className="font-bold text-zinc-900">{fmtMoney(data.booking.subtotalPs)}</span>
        </div>
        {data.booking.discountPs > 0 && (
          <div className="flex justify-between text-emerald-700 font-bold">
            <span>Discount ({appliedCoupon ?? "Coupon"})</span>
            <span>-{fmtMoney(data.booking.discountPs)}</span>
          </div>
        )}
        <div className="flex justify-between text-zinc-600">
          <span>Convenience / Service Fee</span>
          <span className="font-bold text-zinc-900">{fmtMoney(data.booking.feePs)}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-100 pt-3.5 text-lg sm:text-xl font-black text-zinc-900">
          <span>Total Payable</span>
          <span>{fmtMoney(total)}</span>
        </div>
      </div>

      {/* Coupon section */}
      <div className="card space-y-2.5 p-6 bg-white border border-zinc-200/80 rounded-2xl shadow-sm">
        <label className="text-sm font-bold text-zinc-800 block">Promotional Code</label>
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm">
            <span className="font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              {appliedCoupon} active
            </span>
            <button
              type="button"
              className="btn btn-ghost text-xs text-zinc-600 hover:text-zinc-900 py-1 px-2.5"
              onClick={() => applyCoupon(null)}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <input
              className="input text-sm py-2.5"
              placeholder="Enter discount code (e.g. EARLY20)"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              className="btn btn-secondary text-sm font-bold px-5"
              onClick={() => applyCoupon(couponInput.trim() || null)}
              disabled={!couponInput.trim()}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Payment Action */}
      <div className="card space-y-4 p-6 bg-white border border-zinc-200/80 rounded-2xl shadow-sm">
        <label className="text-sm font-bold text-zinc-800 block">Payment Method</label>

        {data.gatewayMode === "RAZORPAY" ? (
          <button
            className="btn btn-primary w-full text-base font-bold py-3.5 rounded-xl shadow-sm"
            onClick={pay}
            disabled={paying || secondsLeft <= 0}
          >
            {paying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Wallet className="h-5 w-5 mr-2" />}
            Pay {fmtMoney(total)} with Razorpay
          </button>
        ) : (
          <>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 space-y-1.5">
              <div className="font-bold text-zinc-900 flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4.5 w-4.5 text-zinc-900" />
                Demo Payment Gateway (Mock Mode)
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Payment is simulated instantly for local testing without real monetary movement.
              </p>
            </div>

            <button
              className="btn btn-primary w-full text-base font-bold py-3.5 rounded-xl shadow-sm"
              onClick={pay}
              disabled={paying || secondsLeft <= 0}
            >
              {paying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CreditCard className="h-5 w-5 mr-2" />}
              Confirm & Pay {fmtMoney(total)}
            </button>

            <button
              type="button"
              className="btn btn-ghost w-full text-xs text-zinc-500 hover:text-zinc-800 py-1"
              onClick={async () => {
                setPaying(true);
                try {
                  const res = await fetch("/api/checkout/mock-pay", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingRef: reference, simulateFailure: true }),
                  });
                  const d = await res.json();
                  setToast({ msg: d.reason ? `Declined: ${d.reason}` : "Payment declined", tone: "error" });
                } finally { setPaying(false); }
              }}
              disabled={paying}
            >
              Simulate declined transaction
            </button>
          </>
        )}

        <div className="text-center text-xs text-zinc-400 pt-1 flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Encrypted checkout · Signed digital QR passes issued immediately</span>
        </div>
      </div>
    </div>
  );
}
