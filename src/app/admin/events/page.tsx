"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fmtDate, prettyStatus, statusBadge } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { Spinner, Toast } from "@/components/ui";

type AdminEvent = {
  id: string; slug: string; title: string; status: string; category: string; city: string;
  startsAt: string; organizer: string; organizerStatus: string | null; sold: number;
  capacity: number; gmvPs: number; createdAt: string;
};

const FILTERS = ["all", "PUBLISHED", "DRAFT", "PAUSED", "CANCELLED", "REJECTED"] as const;

export default function AdminEvents() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/events${filter !== "all" ? `?status=${filter}` : ""}`, { cache: "no-store" });
    const d = await res.json();
    setEvents(d.events ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function act(eventId: string, action: string) {
    const reason = action === "reject" || action === "takedown" ? prompt("Reason (sent to organizer):") ?? undefined : undefined;
    if ((action === "reject" || action === "takedown") && !reason) return;
    const res = await fetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, action, reason }),
    });
    const d = await res.json();
    if (!res.ok) setToast({ msg: d.error || "Failed", tone: "error" });
    else { setToast({ msg: "Moderation applied ✓", tone: "success" }); load(); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Event moderation</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Approve, pause or take down marketplace listings</p>
      </div>
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip border ${filter === f ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"}`}
          >
            {prettyStatus(f)}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Organizer</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Sales</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/events/${e.slug}`} className="font-semibold hover:text-brand-700 dark:hover:text-brand-300">{e.title}</Link>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{e.category} · {e.city} · {fmtDate(e.startsAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium">{e.organizer}</div>
                      {e.organizerStatus && (
                        <span className={`chip mt-0.5 ${e.organizerStatus === "VERIFIED" ? "badge-green" : e.organizerStatus === "PENDING" ? "badge-amber" : "badge-red"}`}>
                          {e.organizerStatus.toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`chip ${statusBadge(e.status)}`}>{prettyStatus(e.status)}</span></td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold">{e.sold}/{e.capacity}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{fmtMoney(e.gmvPs)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 text-xs">
                        {e.status === "DRAFT" && <button className="btn-ghost" onClick={() => act(e.id, "approve")}>Approve</button>}
                        {e.status === "PUBLISHED" && <button className="btn-ghost text-amber-600 dark:text-amber-300" onClick={() => act(e.id, "pause")}>Pause</button>}
                        {(e.status === "PUBLISHED" || e.status === "PAUSED") && (
                          <button className="btn-ghost text-rose-600 dark:text-rose-300" onClick={() => act(e.id, "takedown")}>Takedown</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {events.length === 0 && <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">No events match this filter.</div>}
        </div>
      )}
    </div>
  );
}
