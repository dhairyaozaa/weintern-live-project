"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import { EventCard, type EventCardData } from "@/components/event-card";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/format";
import { Spinner, EmptyState } from "@/components/ui";

type ApiEvent = EventCardData & { maxPricePs?: number; viewCount?: number };

const CITIES = ["all", "Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Jaipur"];
const WHEN = [
  ["all", "Anytime"],
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
] as const;

function BrowseInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "all");
  const [city, setCity] = useState("all");
  const [when, setWhen] = useState<string>("all");
  const [sort, setSort] = useState("soon");
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (category !== "all") usp.set("category", category);
    if (city !== "all") usp.set("city", city);
    if (when !== "all") usp.set("when", when);
    usp.set("sort", sort);
    usp.set("page", String(page));
    const res = await fetch(`/api/events?${usp}`);
    const data = await res.json();
    setEvents(data.events ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [q, category, city, when, sort, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = Math.ceil(total / 20);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Browse events</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{total} upcoming events</p>
      </div>

      {/* Search + filter bar */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search events, venues, cities…"
              className="input pl-9"
            />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-auto">
            <option value="soon">Starting soon</option>
            <option value="price">Price: low → high</option>
            <option value="popular">Most viewed</option>
          </select>
          <button className="btn-secondary lg:hidden" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" /> Filters
          </button>
        </div>

        <div className={`${showFilters ? "space-y-3" : "hidden lg:block"} space-y-3`}>
          <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => { setCategory("all"); setPage(1); }}
              className={`chip border ${category === "all" ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); setPage(1); }}
                className={`chip whitespace-nowrap border ${category === c ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                {CATEGORY_EMOJI[c]} {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} className="input w-auto">
              {CITIES.map((c) => <option key={c} value={c}>{c === "all" ? "All cities" : c}</option>)}
            </select>
            <div className="flex gap-1">
              {WHEN.map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => { setWhen(v); setPage(1); }}
                  className={`chip border ${when === v ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {(q || category !== "all" || city !== "all" || when !== "all") && (
              <button
                onClick={() => { setQ(""); setCategory("all"); setCity("all"); setWhen("all"); }}
                className="btn-ghost text-xs"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner label="Finding events…" />
      ) : events.length === 0 ? (
        <EmptyState title="No events found" body="Try different filters or check back soon — organizers publish new events daily." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((e, i) => <EventCard key={e.slug} event={e} index={i} />)}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span className="text-sm text-slate-500 dark:text-slate-400">Page {page} of {pages}</span>
              <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<Spinner label="Loading events…" />}>
      <BrowseInner />
    </Suspense>
  );
}
