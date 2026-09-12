"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCard, Loader2, Timer, Wallet, X } from "lucide-react";
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
        // Load Razorpay checkout.js on demand
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
            theme: { color: "#4f46e5" },
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

  if (loading) return <Spinner label="Loading checkout…" />;
  if (error || !data)
    return (
      <div className="card mx-auto max-w-md space-y-3 p-8 text-center">
        <div className="text-4xl">⏰</div>
        <h1 className="text-lg font-bold">{error || "Checkout unavailable"}</h1>
        <Link href="/browse" className="btn-primary">Browse events</Link>
      </div>
    );

  const total = data.booking.totalPs;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      <div className="card flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Complete your purchase</div>
          <div className="font-bold">{data.event.title}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{data.tickets.length} × {data.tickets[0]?.tier} ticket</div>
        </div>
        <div className={`chip ${secondsLeft < 120 ? "bg-rose-50 text-rose-700 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:text-amber-300"}`}>
          <Timer className="h-3.5 w-3.5" /> {countdown(secondsLeft)}
        </div>
      </div>

      <div className="card space-y-2 p-4 text-sm">
        <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Subtotal</span><span>{fmtMoney(data.booking.subtotalPs)}</span></div>
        {data.booking.discountPs > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-300">
            <span>Coupon {appliedCoupon ?? ""}</span>
            <span>−{fmtMoney(data.booking.discountPs)}</span>
          </div>
        )}
        <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Convenience fee</span><span>{fmtMoney(data.booking.feePs)}</span></div>
        <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-base font-extrabold">
          <span>Total</span><span>{fmtMoney(total)}</span>
        </div>
      </div>

      <div className="card space-y-2 p-4">
        <div className="label">Have a coupon?</div>
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{appliedCoupon} applied 🎉</span>
            <button className="btn-ghost text-xs" onClick={() => applyCoupon(null)}>
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="e.g. EARLY20"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            />
            <button className="btn-secondary" onClick={() => applyCoupon(couponInput.trim() || null)} disabled={!couponInput.trim()}>
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="card space-y-3 p-4">
        <div className="label">Payment method</div>
        {data.gatewayMode === "RAZORPAY" ? (
          <button className="btn-primary w-full" onClick={pay} disabled={paying || secondsLeft <= 0}>
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Pay {fmtMoney(total)} with Razorpay
          </button>
        ) : (
          <>
            <div className="rounded-lg border border-dashed border-brand-300 bg-brand-50 p-3 text-xs text-brand-800">
              <b>Demo gateway (MOCK mode).</b> Payment is simulated — no real money moves.
              Switch to Razorpay by setting <code>GATEWAY_MODE=RAZORPAY</code> + test keys in <code>.env</code>.
            </div>
            <button className="btn-primary w-full" onClick={pay} disabled={paying || secondsLeft <= 0}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Pay {fmtMoney(total)}
            </button>
            <button
              className="btn-ghost w-full text-xs"
              onClick={async () => {
                setPaying(true);
                try {
                  const res = await fetch("/api/checkout/mock-pay", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingRef: reference, simulateFailure: true }),
                  });
                  const d = await res.json();
                  setToast({ msg: d.reason ? `Simulated failure: ${d.reason}` : "Simulated failure", tone: "error" });
                } finally { setPaying(false); }
              }}
              disabled={paying}
            >
              Simulate failed payment
            </button>
          </>
        )}
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
          Secured checkout · QR tickets issued instantly after payment
        </p>
      </div>
    </div>
  );
}
