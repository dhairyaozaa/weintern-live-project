"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays, Clock, MapPin, ShieldCheck, Ticket, Users, Zap, Loader2,
  Bell, AlertCircle, ArrowLeft
} from "lucide-react";
import { fmtDateLong, fmtTime } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { CategoryIcon } from "@/components/event-card";
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

  // Live availability over SSE
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
      if (!res.ok) throw new Error(data.error || "Could not reserve ticket");
      router.push(`/checkout/${data.booking.reference}`);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to reserve ticket", tone: "error" });
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
      setToast({ msg: "You have been added to the waitlist. We will notify you if tickets open up.", tone: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed to join waitlist", tone: "error" });
    }
  }

  if (loading) return <Spinner label="Loading event details..." />;
  if (error || !event)
    return (
      <div className="card mx-auto max-w-md p-10 text-center bg-white border border-zinc-200/80 rounded-2xl">
        <AlertCircle className="mx-auto h-12 w-12 text-zinc-400" />
        <h1 className="mt-4 text-xl font-bold text-zinc-900">{error || "Event not found"}</h1>
        <p className="mt-2 text-sm text-zinc-600">The event you are looking for may have been unpublished or removed.</p>
        <Link href="/browse" className="btn btn-primary mt-6 text-sm">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Directory
        </Link>
      </div>
    );

  const isUpcoming = new Date(event.startsAt) > new Date();

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/browse" className="hover:text-zinc-900 transition flex items-center gap-1.5 font-medium">
          <ArrowLeft className="h-4 w-4" /> Browse Events
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-semibold truncate">{event.title}</span>
      </div>

      {/* Main Container */}
      <div className="card overflow-hidden bg-white border border-zinc-200/80 shadow-card rounded-3xl">
        {/* Banner Area */}
        <div className="relative h-64 sm:h-80 lg:h-96 w-full overflow-hidden bg-zinc-100 border-b border-zinc-200/60">
          {event.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.bannerUrl} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-zinc-400">
              <CategoryIcon category={event.category} className="h-16 w-16 text-zinc-300 stroke-[1.2]" />
              <span className="text-sm font-bold tracking-wider uppercase text-zinc-500">{event.category} Event</span>
            </div>
          )}

          <div className="absolute left-5 top-5 flex flex-wrap gap-2.5">
            <span className="chip bg-white/95 text-zinc-900 backdrop-blur shadow-sm border border-zinc-200/60 text-sm font-bold px-3.5 py-1.5">
              {event.category}
            </span>
            {event.liveMode && (
              <span className="chip bg-rose-600 text-white font-bold flex items-center gap-1.5 shadow-sm text-sm px-3 py-1.5">
                <span className="h-1.5 w-1.5 bg-white shrink-0" />
                LIVE NOW
              </span>
            )}
            {event.soldOut && (
              <span className="chip bg-zinc-900 text-white font-bold text-sm px-3.5 py-1.5 shadow-sm">
                Sold Out
              </span>
            )}
          </div>
        </div>

        {/* Detail Body */}
        <div className="grid gap-10 p-7 sm:p-10 lg:grid-cols-[1fr_400px]">
          {/* Left Column: Description & Metadata */}
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 leading-[1.15]">
                {event.title}
              </h1>

              <div className="flex items-center gap-2.5 text-sm sm:text-base text-zinc-600">
                <span>Presented by</span>
                <span className="font-bold text-zinc-900">{event.organizer}</span>
                {event.verified && (
                  <span className="badge-green inline-flex items-center gap-1.5 py-1 px-2.5 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified Organizer
                  </span>
                )}
              </div>
            </div>

            {/* Time / Venue Grid */}
            <div className="grid gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 sm:grid-cols-2 text-sm sm:text-base">
              <div className="flex items-start gap-3 text-zinc-700">
                <CalendarDays className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-zinc-900">{fmtDateLong(event.startsAt)}</div>
                  <div className="text-sm text-zinc-600 mt-0.5">{fmtTime(event.startsAt)} – {fmtTime(event.endsAt)}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 text-zinc-700">
                <MapPin className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-zinc-900">{event.venueName}</div>
                  <div className="text-sm text-zinc-600 mt-0.5">{event.city}{event.address ? ` · ${event.address}` : ""}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-zinc-700 sm:col-span-2 pt-3 border-t border-zinc-200/70 text-sm font-semibold">
                <Users className="h-5 w-5 text-zinc-500 shrink-0" />
                <div>
                  <span className="font-black text-zinc-900">{stats.totalSold}</span> of {stats.totalCapacity} capacity booked ({stats.fillPct}% full)
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">About this event</h2>
              <p className="whitespace-pre-line text-base sm:text-lg leading-relaxed text-zinc-700 font-normal">
                {event.description}
              </p>
            </div>

            {event.organizerAbout && (
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">About the Host</div>
                <p className="text-sm sm:text-base leading-relaxed text-zinc-600">{event.organizerAbout}</p>
                {event.supportEmail && (
                  <div className="text-sm text-zinc-500 pt-2">
                    Inquiries: <span className="font-semibold text-zinc-900">{event.supportEmail}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Ticket Tiers & Buy Box */}
          <div>
            <div className="card sticky top-24 space-y-5 p-6 sm:p-7 bg-white border border-zinc-200/90 shadow-md rounded-2xl">
              <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Pricing</span>
                  <div className="text-2xl sm:text-3xl font-black text-zinc-900">
                    {stats.minPricePs === 0 ? "Free Admission" : fmtMoney(stats.minPricePs)}
                  </div>
                </div>
                {event.status === "PAUSED" && <span className="badge-amber text-xs font-bold">Sales Paused</span>}
                {event.liveMode && <span className="badge-red font-bold text-xs">LIVE</span>}
              </div>

              {/* Tiers List */}
              <div className="space-y-4">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`rounded-xl border p-4.5 transition ${
                      tier.soldOut
                        ? "border-zinc-100 bg-zinc-50 opacity-60"
                        : "border-zinc-200 hover:border-zinc-300 bg-white shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm sm:text-base font-bold text-zinc-900">{tier.name}</div>
                        {tier.description && (
                          <div className="text-xs sm:text-sm text-zinc-500 mt-1">{tier.description}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base sm:text-lg font-black text-zinc-900">{fmtMoney(tier.pricePs)}</div>
                        <div className="text-xs font-semibold text-zinc-500 mt-0.5">
                          {tier.remaining > 0 ? `${tier.remaining} left` : "Sold out"}
                        </div>
                      </div>
                    </div>

                    <ProgressBar pct={tier.fillPct} className="mt-3.5" />

                    {!tier.soldOut && event.status === "PUBLISHED" && (
                      <div className="mt-4 flex items-center gap-2.5">
                        <select
                          className="input w-auto py-2 text-sm font-semibold rounded-lg"
                          value={qty[tier.id] ?? 1}
                          onChange={(e) => setQty({ ...qty, [tier.id]: Number(e.target.value) })}
                        >
                          {Array.from({ length: Math.min(tier.perUserLimit, tier.remaining) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n} {n === 1 ? "ticket" : "tickets"}</option>
                          ))}
                        </select>
                        <button
                          className="btn btn-primary flex-1 text-sm py-2.5 font-bold rounded-lg"
                          disabled={buying === tier.id}
                          onClick={() => reserve(tier.id)}
                        >
                          {buying === tier.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Ticket className="h-4 w-4 mr-1.5" />
                          )}
                          Reserve & Checkout
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {event.soldOut && event.status === "PUBLISHED" && (
                <button
                  className="btn btn-secondary w-full text-sm font-bold py-3 rounded-xl"
                  onClick={joinWaitlist}
                >
                  <Bell className="h-4 w-4 mr-2" /> Join Waitlist
                </button>
              )}

              {!isUpcoming && (
                <div className="rounded-xl bg-zinc-100 p-4 text-center text-sm font-medium text-zinc-600">
                  This event has already commenced or concluded.
                </div>
              )}

              <div className="pt-2 text-center text-xs text-zinc-500 leading-relaxed border-t border-zinc-100 font-medium">
                Tickets are locked for 10 minutes during checkout to guarantee your seat without conflict.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
