"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, Spinner } from "@/components/ui";

type Notification = {
  id: string; kind: string; title: string; body: string; link: string | null;
  readAt: string | null; createdAt: string;
};

const KIND_ICON: Record<string, string> = {
  SYSTEM: "⚙️", BOOKING: "💳", WAITLIST: "⏳", EVENT_UPDATE: "📣", TICKET: "🎟️",
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const d = await res.json();
    setItems(d.notifications ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Booking updates, waitlist alerts and announcements</p>
        </div>
        {items.some((i) => !i.readAt) && (
          <button className="btn-secondary" onClick={markAll}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="All caught up" body="Notifications about your bookings and events will appear here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const inner = (
              <div className={`card flex gap-3 p-4 ${!n.readAt ? "border-brand-200 bg-brand-50/40 dark:border-brand-500/30 dark:bg-brand-500/10" : ""}`}>
                <span className="text-xl">{KIND_ICON[n.kind] ?? "🔔"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{n.title}</span>
                    {!n.readAt && <span className="h-2 w-2 shrink-0 bg-zinc-900" />}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{n.body}</p>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{fmtDateTime(n.createdAt)}</span>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} onClick={() => { fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }); }}>
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
