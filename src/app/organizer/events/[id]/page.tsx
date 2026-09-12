"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck, Loader2, Megaphone, Pause, Play, Plus, Tag, Trash2, Users, Zap,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar,
} from "recharts";
import { fmtDateLong, fmtDateTime, prettyStatus, statusBadge, timeUntil } from "@/lib/format";
import { fmtMoney, toPs } from "@/lib/money";
import { ProgressBar, Spinner, StatCard, Toast } from "@/components/ui";

type Tier = {
  id: string; name: string; description?: string | null; pricePs: number; basePricePs: number;
  dynamicFloorPs: number; capacity: number; sold: number; heldCount: number; remaining: number;
  perUserLimit: number;
};
type Detail = {
  event: {
    id: string; slug: string; title: string; status: string; liveMode: boolean; startsAt: string;
    endsAt: string; venueName: string; city: string; bannerUrl: string | null; category: string;
    description: string; pricingMode: string; earlyBirdEnds: string | null; soldOut: boolean;
  };
  tiers: Tier[];
  stats: {
    grossPs: number; commissionPs: number; netPs: number; refundedPs: number; feeBps: number;
    convenienceBps: number; ticketsSold: number; checkedIn: number; bookings: number;
  };
  attendees: { bookingRef: string; userName: string; email: string; tickets: number; checkedIn: number; totalPs: number; status: string; createdAt: string }[];
  bookings: { id: string; reference: string; userName: string; tickets: number; totalPs: number; status: string; createdAt: string }[];
};

export default function OrganizerEventDashboard() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);
  const [tab, setTab] = useState<"overview" | "tiers" | "attendees" | "marketing">("overview");

  // broadcast form
  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [sending, setSending] = useState(false);
  // coupon form
  const [coupon, setCoupon] = useState({ code: "", discountType: "PERCENT", value: "10", minOrder: "0", maxRedemptions: "", expiresAt: "" });
  const [coupons, setCoupons] = useState<{ id: string; code: string; label: string; redemptionCount: number; maxRedemptions: number | null; active: boolean }[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/organizer/events/manage?id=${id}`, { cache: "no-store" });
    const d = await res.json();
    if (!res.ok) { setError(d.error || "Failed"); setLoading(false); return; }
    setData(d);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // live polling for sales updates
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const loadCoupons = useCallback(async () => {
    const res = await fetch(`/api/organizer/coupons?eventId=${id}`);
    const d = await res.json();
    setCoupons(d.coupons ?? []);
  }, [id]);
  useEffect(() => { if (tab === "marketing") loadCoupons(); }, [tab, loadCoupons]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch(`/api/organizer/events/manage?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json();
    if (!res.ok) setToast({ msg: d.error || "Failed", tone: "error" });
    else { setToast({ msg: "Done ✓", tone: "success" }); load(); }
  }

  async function sendBroadcast() {
    setSending(true);
    try {
      const res = await fetch(`/api/organizer/events/broadcast?id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: bcTitle, body: bcBody, target: "ALL" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToast({ msg: `Sent to ${d.sent} attendees`, tone: "success" });
      setBcTitle(""); setBcBody("");
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    } finally { setSending(false); }
  }

  async function createCoupon() {
    try {
      const res = await fetch("/api/organizer/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: id,
          code: coupon.code,
          discountType: coupon.discountType,
          value: Number(coupon.value),
          minOrder: Number(coupon.minOrder) || 0,
          maxRedemptions: coupon.maxRedemptions ? Number(coupon.maxRedemptions) : undefined,
          expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToast({ msg: `Coupon ${coupon.code.toUpperCase()} created`, tone: "success" });
      setCoupon({ code: "", discountType: "PERCENT", value: "10", minOrder: "0", maxRedemptions: "", expiresAt: "" });
      loadCoupons();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    }
  }

  const salesSeries = useMemo(() => {
    if (!data) return [];
    const byDay = new Map<string, number>();
    for (const a of data.attendees) {
      const day = new Date(a.createdAt).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + a.totalPs);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, ps]) => ({ day: day.slice(5), rupees: ps / 100 }));
  }, [data]);

  if (loading) return <Spinner label="Loading event dashboard…" />;
  if (error || !data)
    return <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">{error || "Not found"}</div>;

  const { event, tiers, stats, attendees } = data;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      {/* Header */}
      <div className="card overflow-hidden">
        <div className="relative h-28 bg-gradient-to-br from-brand-600 to-purple-600">
          {event.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${statusBadge(event.status)}`}>{prettyStatus(event.status)}</span>
              {event.liveMode && <span className="badge-red animate-pulseSoft">● LIVE</span>}
              {event.soldOut && <span className="badge-slate">Sold out</span>}
              <span className="text-xs text-slate-400 dark:text-slate-500">{event.startsAt ? `${fmtDateLong(event.startsAt)} · ${timeUntil(event.startsAt)}` : ""}</span>
            </div>
            <h1 className="truncate text-xl font-extrabold">{event.title}</h1>
            <div className="text-xs text-slate-500 dark:text-slate-400">{event.venueName}, {event.city}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {event.status === "DRAFT" && <button className="btn-primary" onClick={() => act("publish")}>🚀 Publish</button>}
            {event.status === "PUBLISHED" && (
              <>
                <button className="btn-secondary" onClick={() => act("toggleLive")}>
                  <Zap className={`h-4 w-4 ${event.liveMode ? "text-rose-600 dark:text-rose-300" : "text-amber-500"}`} />
                  {event.liveMode ? "End live mode" : "Go live"}
                </button>
                <button className="btn-secondary" onClick={() => act("pause")}>
                  <Pause className="h-4 w-4" /> Pause
                </button>
              </>
            )}
            {event.status === "PAUSED" && (
              <button className="btn-primary" onClick={() => act("resume")}><Play className="h-4 w-4" /> Resume</button>
            )}
            <Link href={`/events/${event.slug}`} className="btn-secondary">Public page ↗</Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross sales" value={fmtMoney(stats.grossPs)} accent="green" sub={`${stats.ticketsSold} tickets`} />
        <StatCard label="Platform commission" value={fmtMoney(stats.commissionPs)} accent="amber" sub={`${(stats.feeBps / 100).toFixed(1)}% rate`} />
        <StatCard label="Net payout" value={fmtMoney(stats.netPs)} accent="brand" sub="after commission" />
        <StatCard label="Checked in" value={`${stats.checkedIn}/${stats.ticketsSold}`} accent="slate" sub={`${attendees.length} bookings`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(["overview", "tiers", "attendees", "marketing"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-brand-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Revenue over time</h2>
            {salesSeries.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No sales yet — share your event link to get started.</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesSeries}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Sales"]} />
                    <Area type="monotone" dataKey="rupees" stroke="#6366f1" fill="url(#rev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Sales by tier</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tiers.map((t) => ({ name: t.name, sold: t.sold, remaining: Math.max(0, t.capacity - t.sold) }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="sold" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="remaining" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Recent bookings</h2>
            {data.bookings.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No bookings yet.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {data.bookings.slice(0, 8).map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-semibold">{b.reference}</span>
                      <span className="ml-2 text-slate-500 dark:text-slate-400">{b.userName} · {b.tickets} ticket{b.tickets > 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`chip ${statusBadge(b.status)}`}>{prettyStatus(b.status)}</span>
                      <span className="font-semibold">{fmtMoney(b.totalPs)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "tiers" && (
        <div className="space-y-3">
          {tiers.map((t) => (
            <TierEditor key={t.id} tier={t} onSave={(patch) => act("updateTier", { tierId: t.id, ...patch })} />
          ))}
          <AddTier onAdd={(payload) => act("addTier", payload)} />
        </div>
      )}

      {tab === "attendees" && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h2 className="text-sm font-bold">Attendees ({attendees.length})</h2>
            <Link href="/organizer/checkin" className="btn-primary py-1.5 text-xs">Open check-in console</Link>
          </div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2">Booking</th>
                  <th className="px-4 py-2">Attendee</th>
                  <th className="px-4 py-2">Tickets</th>
                  <th className="px-4 py-2">Checked in</th>
                  <th className="px-4 py-2">Paid</th>
                  <th className="px-4 py-2 text-right">Refund</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.bookingRef} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">{a.bookingRef}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{a.userName}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{a.email}</div>
                    </td>
                    <td className="px-4 py-2">{a.tickets}</td>
                    <td className="px-4 py-2">
                      {a.checkedIn === a.tickets ? <span className="badge-green">all in</span> : <span className="badge-slate">{a.checkedIn}/{a.tickets}</span>}
                    </td>
                    <td className="px-4 py-2 font-semibold">{fmtMoney(a.totalPs)}</td>
                    <td className="px-4 py-2 text-right">
                      {a.status === "CONFIRMED" && (
                        <button
                          className="btn-ghost text-xs text-rose-600 dark:text-rose-300"
                          onClick={async () => {
                            if (!confirm(`Refund ${a.bookingRef} (${fmtMoney(a.totalPs)})?`)) return;
                            const res = await fetch(`/api/bookings/${a.bookingRef}/refund`, {
                              method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
                            });
                            const d = await res.json();
                            setToast({ msg: res.ok ? "Refund processed" : d.error || "Failed", tone: res.ok ? "success" : "error" });
                            load();
                          }}
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "marketing" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Megaphone className="h-4 w-4" /> Broadcast to attendees</h2>
            <input className="input" placeholder="Announcement title" value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} />
            <textarea className="input" rows={3} placeholder="Lineup change? Gate timing? Tell your attendees…" value={bcBody} onChange={(e) => setBcBody(e.target.value)} />
            <button className="btn-primary" onClick={sendBroadcast} disabled={sending || !bcTitle || !bcBody}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} Send broadcast
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500">Delivers to the in-app inbox of everyone with a booking on this event.</p>
          </div>

          <div className="card space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold"><Tag className="h-4 w-4" /> Coupons</h2>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="CODE" value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value.toUpperCase() })} />
              <select className="input" value={coupon.discountType} onChange={(e) => setCoupon({ ...coupon, discountType: e.target.value })}>
                <option value="PERCENT">% off</option>
                <option value="FLAT">₹ flat off</option>
              </select>
              <input className="input" type="number" placeholder={coupon.discountType === "PERCENT" ? "10 (%)" : "100 (₹)"} value={coupon.value} onChange={(e) => setCoupon({ ...coupon, value: e.target.value })} />
              <input className="input" type="number" placeholder="Min order ₹ (0)" value={coupon.minOrder} onChange={(e) => setCoupon({ ...coupon, minOrder: e.target.value })} />
              <input className="input" type="number" placeholder="Max uses (optional)" value={coupon.maxRedemptions} onChange={(e) => setCoupon({ ...coupon, maxRedemptions: e.target.value })} />
              <input className="input" type="date" value={coupon.expiresAt} onChange={(e) => setCoupon({ ...coupon, expiresAt: e.target.value })} />
            </div>
            <button className="btn-secondary" onClick={createCoupon} disabled={!coupon.code || !coupon.value}>
              <Plus className="h-4 w-4" /> Create coupon
            </button>
            <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
              {coupons.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No coupons yet.</p>}
              {coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 text-sm">
                  <div>
                    <span className="font-mono font-bold">{c.code}</span>
                    <span className="ml-2 text-slate-500 dark:text-slate-400">{c.label}</span>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{c.redemptionCount}{c.maxRedemptions ? `/${c.maxRedemptions}` : ""} redeemed</div>
                  </div>
                  <button
                    className={`chip ${c.active ? "badge-green" : "badge-slate"}`}
                    onClick={async () => {
                      await fetch("/api/organizer/coupons", {
                        method: "PATCH", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: c.id, active: !c.active }),
                      });
                      loadCoupons();
                    }}
                  >
                    {c.active ? "active" : "paused"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TierEditor({ tier, onSave }: { tier: Tier; onSave: (patch: Record<string, unknown>) => void }) {
  const [price, setPrice] = useState(String(tier.pricePs / 100));
  const [capacity, setCapacity] = useState(String(tier.capacity));
  const [limit, setLimit] = useState(String(tier.perUserLimit));
  const [floor, setFloor] = useState(String(tier.dynamicFloorPs / 100));
  const [saving, setSaving] = useState(false);

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-bold">{tier.name}</span>
          {tier.description && <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{tier.description}</span>}
        </div>
        <span className="badge-slate">{tier.sold}/{tier.capacity} sold · {tier.heldCount} on hold</span>
      </div>
      <ProgressBar pct={tier.capacity ? Math.round((tier.sold / tier.capacity) * 100) : 0} />
      <div className="grid gap-2 sm:grid-cols-5">
        <div>
          <label className="label">Price ₹</label>
          <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label">Capacity</label>
          <input className="input" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div>
          <label className="label">Per-user limit</label>
          <input className="input" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <div>
          <label className="label">Floor ₹ (dynamic)</label>
          <input className="input" type="number" value={floor} onChange={(e) => setFloor(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button
            className="btn-primary w-full"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              onSave({ price: Number(price), capacity: Number(capacity), perUserLimit: Number(limit), dynamicFloor: Number(floor) });
              setSaving(false);
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AddTier({ onAdd }: { onAdd: (payload: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");

  if (!open)
    return (
      <button className="btn-secondary w-full" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add another tier
      </button>
    );

  return (
    <div className="card space-y-2 p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" placeholder="Tier name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" type="number" placeholder="Price ₹" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className="input" type="number" placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={!name || !price || !capacity}
          onClick={() => {
            onAdd({ name, price: Number(price), capacity: Number(capacity) });
            setOpen(false); setName(""); setPrice(""); setCapacity("");
          }}
        >
          Add tier
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
