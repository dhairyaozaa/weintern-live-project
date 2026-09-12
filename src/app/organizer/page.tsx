"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, TrendingUp, Users, Wallet, Zap, Eye, Copy, Pause, Play, Flag,
} from "lucide-react";
import { fmtDate, prettyStatus, statusBadge } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { ProgressBar, Spinner, StatCard, Toast } from "@/components/ui";

type EventRow = {
  id: string; slug: string; title: string; status: string; city: string; category: string;
  startsAt: string; soldOut: boolean; liveMode: boolean; capacity: number; sold: number;
  soldPct: number; revenuePs: number; bookings: number; waitlist: number;
};

export default function OrganizerDashboard() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/organizer/events", { method: "PUT" });
    const d = await res.json();
    setEvents(d.events ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function action(eventId: string, action: string) {
    const res = await fetch(`/api/organizer/events/manage?id=${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    if (!res.ok) setToast({ msg: d.error || "Action failed", tone: "error" });
    else load();
  }

  const totals = events.reduce(
    (acc, e) => ({
      revenue: acc.revenue + e.revenuePs,
      sold: acc.sold + e.sold,
      bookings: acc.bookings + e.bookings,
    }),
    { revenue: 0, sold: 0, bookings: 0 }
  );

  if (loading) return <Spinner label="Loading dashboard…" />;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.msg} tone={toast.tone} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">Organizer dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Events, sales and check-in ops</p>
        </div>
        <Link href="/organizer/events/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New event
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross sales" value={fmtMoney(totals.revenue)} accent="green" sub="all events, excl. refunds" />
        <StatCard label="Tickets sold" value={String(totals.sold)} accent="brand" />
        <StatCard label="Bookings" value={String(totals.bookings)} accent="slate" />
        <StatCard label="Live events" value={String(events.filter((e) => e.liveMode).length)} accent="amber" sub="happening now" />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 text-sm font-bold">My events</div>
        {events.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No events yet. <Link href="/organizer/events/new" className="font-semibold text-brand-700 dark:text-brand-300">Create your first event →</Link>
          </div>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Sales</th>
                  <th className="px-4 py-2">Revenue</th>
                  <th className="px-4 py-2">Waitlist</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{e.title}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(e.startsAt)} · {e.city} · {e.category}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`chip ${statusBadge(e.status)}`}>{prettyStatus(e.status)}</span>
                      {e.liveMode && <span className="badge-red ml-1">LIVE</span>}
                    </td>
                    <td className="w-40 px-4 py-3">
                      <div className="text-xs font-semibold">{e.sold}/{e.capacity}</div>
                      <ProgressBar pct={e.soldPct} className="mt-1" />
                    </td>
                    <td className="px-4 py-3 font-semibold">{fmtMoney(e.revenuePs)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{e.waitlist > 0 ? `${e.waitlist} waiting` : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link href={`/organizer/events/${e.id}`} className="btn-ghost px-2 py-1.5" title="Open dashboard">
                          <TrendingUp className="h-4 w-4" />
                        </Link>
                        <Link href={`/events/${e.slug}`} className="btn-ghost px-2 py-1.5" title="View public page">
                          <Eye className="h-4 w-4" />
                        </Link>
                        {e.status === "DRAFT" && (
                          <button className="btn-ghost px-2 py-1.5" title="Publish" onClick={() => action(e.id, "publish")}>
                            <Flag className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                          </button>
                        )}
                        {e.status === "PUBLISHED" && (
                          <button className="btn-ghost px-2 py-1.5" title={e.liveMode ? "End live mode" : "Go live"} onClick={() => action(e.id, "toggleLive")}>
                            <Zap className={`h-4 w-4 ${e.liveMode ? "text-rose-600 dark:text-rose-300" : "text-amber-500"}`} />
                          </button>
                        )}
                        {e.status === "PUBLISHED" && (
                          <button className="btn-ghost px-2 py-1.5" title="Pause sales" onClick={() => action(e.id, "pause")}>
                            <Pause className="h-4 w-4 text-amber-500" />
                          </button>
                        )}
                        {e.status === "PAUSED" && (
                          <button className="btn-ghost px-2 py-1.5" title="Resume" onClick={() => action(e.id, "resume")}>
                            <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
