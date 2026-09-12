"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays, Clock, MapPin, ShieldCheck, Ticket, Users, Zap, Loader2,
} from "lucide-react";
import { fmtDateLong, fmtTime, CATEGORY_EMOJI } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { ProgressBar, Spinner, Toast } from "@/components/ui";

type Tier = {
  id: string; name: string; description?: string | null; pricePs: number;
  remaining: number; capacity: number; sold: number; perUserLimit: number;
  soldOut: boolean; fillPct: number;
};
type EventData = {
  id: string; slug: string; title: string; description: string; category: string;
  bannerUrl?: string | null; venueName: string; city: string; address?: string | null;
  startsAt: string; endsAt: string; status: string; liveMode: boolean; soldOut: boolean;
  organizer: string; verified: boolean; organizerAbout?: string | null;
  supportEmail?: string | null; pricingMode: string; earlyBirdEnds?: string | null;
};

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stats, setStats] = useState({ fillPct: 0, totalSold: 0, totalCapacity: 0, minPricePs: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" | "info" } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Event not found");
      setEvent(data.event);
      setTiers(data.tiers);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // Live availability over SSE — reconnects automatically by browser.
  useEffect(() => {
    if (!event) return;
    const es = new EventSource(`/api/events/${slug}/stream`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "inventory" || msg.type === "tiers" || msg.type === "status" || msg.type === "liveMode") {
          load();
        }
      } catch {}
    };
    esRef.current = es;
    return () => es.close();
  }, [event?.id, slug, load]);

  async function reserve(tierId: string) {
    setBuying(tierId);
    setToast(null);
    try {
      const quantity = qty[tierId] ?? 1;
      const res = await fetch("/api/checkout/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reserve");
      router.push(`/checkout/${data.booking.reference}`);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
      load();
    } finally {
      setBuying(null);
    }
  }

  async function joinWaitlist() {
    try {
      const res = await fetch(`/api/events/${slug}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 2 }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) return router.push("/login?next=" + encodeURIComponent(`/events/${slug}`));
        throw new Error(data.error);
      }
      setToast({ msg: "You're on the waitlist — we'll ping you when tickets open up!", tone: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    }
  }

  if (loading) return <Spinner label="Loading event…" />;
  if (error || !event)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <div className="text-4xl">🎪</div>
        <h1 className="mt-2 text-lg font-bold">{error || "Event not found"}</h1>
        <Link href="/browse" className="btn-primary mt-4">Browse events</Link>
      </div>
    );

  const isUpcoming = new Date(event.startsAt) > new Date();

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      {/* Banner */}
      <div className="card overflow-hidden">
        <div className="relative h-52 bg-gradient-to-br from-brand-600 to-purple-600 md:h-64">
          {event.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute left-4 top-4 flex gap-2">
            <span className="chip bg-white/90 text-slate-800">
              {CATEGORY_EMOJI[event.category] ?? "🎟️"} {event.category}
            </span>
            {event.liveMode && (
              <span className="chip animate-pulseSoft bg-rose-600 text-white">
                <Zap className="h-3 w-3" /> Happening now
              </span>
            )}
            {event.soldOut && <span className="chip bg-slate-900/80 text-white">Sold out</span>}
          </div>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold md:text-3xl">{event.title}</h1>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                by <span className="font-semibold text-slate-700 dark:text-slate-200">{event.organizer}</span>
                {event.verified && (
                  <span className="badge-green"><ShieldCheck className="h-3 w-3" /> Verified organizer</span>
                )}
              </div>
            </div>

            <div className="grid gap-2 text-sm md:grid-cols-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-600" />
                {fmtDateLong(event.startsAt)}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-600" />
                {fmtTime(event.startsAt)} – {fmtTime(event.endsAt)}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-600" />
                {event.venueName}, {event.city}
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-600" />
                {stats.totalSold}/{stats.totalCapacity} booked · {stats.fillPct}% full
              </div>
            </div>

            <div>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">About this event</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">{event.description}</p>
            </div>

            {event.organizerAbout && (
              <div className="card bg-slate-50 dark:bg-slate-800/60 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">About the organizer</div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.organizerAbout}</p>
              </div>
            )}
          </div>

          {/* Buy box */}
          <div className="space-y-3">
            <div className="card sticky top-20 space-y-3 p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Starting from</div>
                  <div className="text-2xl font-extrabold">{fmtMoney(stats.minPricePs ?? 0)}</div>
                </div>
                {event.status === "PAUSED" && <span className="badge-amber">Sales paused</span>}
                {event.liveMode && <span className="badge-red">LIVE</span>}
              </div>

              {tiers.map((tier) => (
                <div key={tier.id} className={`rounded-lg border p-3 ${tier.soldOut ? "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 opacity-70" : "border-slate-200 dark:border-slate-800"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{tier.name}</div>
                      {tier.description && <div className="text-xs text-slate-500 dark:text-slate-400">{tier.description}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{fmtMoney(tier.pricePs)}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {tier.remaining > 0 ? `${tier.remaining} left` : "sold out"}
                      </div>
                    </div>
                  </div>
                  <ProgressBar pct={tier.fillPct} className="mt-2" />
                  {!tier.soldOut && event.status === "PUBLISHED" && (
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        className="input w-auto py-1 text-sm"
                        value={qty[tier.id] ?? 1}
                        onChange={(e) => setQty({ ...qty, [tier.id]: Number(e.target.value) })}
                      >
                        {Array.from({ length: Math.min(tier.perUserLimit, tier.remaining) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button
                        className="btn-primary flex-1"
                        disabled={buying === tier.id}
                        onClick={() => reserve(tier.id)}
                      >
                        {buying === tier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                        Book now
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {event.soldOut && event.status === "PUBLISHED" && (
                <button className="btn-secondary w-full" onClick={joinWaitlist}>
                  🔔 Join waitlist
                </button>
              )}
              {!isUpcoming && (
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-center text-sm text-slate-500 dark:text-slate-400">
                  This event has already started or ended.
                </div>
              )}
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                Tickets are held for 10 minutes during checkout · <Link href="/login" className="underline">sign in required</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
