"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { fmtMoney } from "@/lib/money";
import { Spinner, StatCard } from "@/components/ui";

type Overview = {
  kpis: {
    users: number; organizers: number; pendingOrganizers: number; events: number;
    publishedEvents: number; bookings: number; gmvPs: number; commissionEstPs: number;
    refundedPs: number; netPs: number;
  };
  settings: { feeBps: number; convenienceBps: number };
  salesSeries: { day: string; gmvPs: number }[];
  topEvents: { title: string; slug: string; organizer: string; gmvPs: number; soldPct: number }[];
};

export default function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <Spinner label="Crunching platform numbers…" />;

  const { kpis } = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Platform overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">GMV, commissions, users and moderation queue</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="GMV (confirmed)" value={fmtMoney(kpis.gmvPs)} accent="green" sub={`${kpis.bookings} bookings`} />
        <StatCard label="Commission est." value={fmtMoney(kpis.commissionEstPs)} accent="amber" sub={`${(data.settings.feeBps / 100).toFixed(1)}% platform fee`} />
        <StatCard label="Refunded" value={fmtMoney(kpis.refundedPs)} accent="rose" />
        <StatCard label="Net volume" value={fmtMoney(kpis.netPs)} accent="brand" sub="GMV − refunds" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={String(kpis.users)} accent="slate" />
        <StatCard label="Organizers" value={String(kpis.organizers)} accent="brand" sub={`${kpis.pendingOrganizers} awaiting verification`} />
        <StatCard label="Events" value={String(kpis.events)} accent="slate" sub={`${kpis.publishedEvents} live`} />
        <StatCard label="Avg booking" value={fmtMoney(kpis.bookings ? Math.round(kpis.gmvPs / kpis.bookings) : 0)} accent="slate" />
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-bold">GMV by day</h2>
        {data.salesSeries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No confirmed sales yet.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesSeries.map((d) => ({ ...d, rupees: d.gmvPs / 100 }))}>
                <defs>
                  <linearGradient id="gmv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "GMV"]} />
                <Area type="monotone" dataKey="rupees" stroke="#10b981" fill="url(#gmv)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-bold">Top events by GMV</h2>
        {data.topEvents.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No events yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.topEvents.map((e, i) => (
              <div key={e.slug} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 text-center font-extrabold text-slate-300">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/events/${e.slug}`} className="truncate font-semibold hover:text-brand-700 dark:hover:text-brand-300">{e.title}</Link>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{e.organizer} · {e.soldPct}% sold</div>
                </div>
                <span className="font-bold">{fmtMoney(e.gmvPs)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {kpis.pendingOrganizers > 0 && (
        <Link href="/admin/organizers" className="card block border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          ⏳ {kpis.pendingOrganizers} organizer{kpis.pendingOrganizers > 1 ? "s" : ""} awaiting verification — review now →
        </Link>
      )}
    </div>
  );
}
