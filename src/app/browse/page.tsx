"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { EventCard, type EventCardData, CategoryIcon } from "@/components/event-card";
import { CATEGORIES } from "@/lib/format";
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-zinc-200/80 pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">Browse Events</h1>
          <p className="text-sm sm:text-base text-zinc-600 mt-1.5">{total} upcoming live events available</p>
        </div>
        <div className="text-sm text-zinc-500 font-semibold">
          Instant QR check-in & verified passes
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="card space-y-4 p-5 sm:p-6 bg-white border border-zinc-200/80 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search by artist, event title, venue, or city..."
              className="input pl-11 text-sm sm:text-base py-3 rounded-xl"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input w-auto text-sm sm:text-base py-3 rounded-xl"
          >
            <option value="soon">Starting soon</option>
            <option value="price">Price: low to high</option>
            <option value="popular">Most viewed</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary lg:hidden text-sm py-3 px-4 rounded-xl"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" /> Filters
          </button>
        </div>

        {/* Category Pills & Filters */}
        <div className={`${showFilters ? "space-y-4" : "hidden lg:block"} space-y-4 pt-3 border-t border-zinc-100`}>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5">
            <button
              onClick={() => { setCategory("all"); setPage(1); }}
              className={`chip border text-sm font-semibold py-1.5 px-4 rounded-xl transition ${
                category === "all"
                  ? "border-zinc-900 bg-zinc-900 text-white font-bold shadow-xs"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); setPage(1); }}
                className={`chip whitespace-nowrap border text-sm font-semibold py-1.5 px-4 rounded-xl flex items-center gap-2 transition ${
                  category === c
                    ? "border-zinc-900 bg-zinc-900 text-white font-bold shadow-xs"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <CategoryIcon category={c} className="h-4 w-4" />
                <span>{c}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3.5 text-sm pt-1">
            <select
              value={city}
              onChange={(e) => { setCity(e.target.value); setPage(1); }}
              className="input w-auto text-sm py-2 px-3.5 rounded-lg"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c === "all" ? "All cities" : c}</option>
              ))}
            </select>

            <div className="flex gap-2">
              {WHEN.map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => { setWhen(v); setPage(1); }}
                  className={`chip border text-sm font-semibold py-1.5 px-3.5 rounded-lg transition ${
                    when === v
                      ? "border-zinc-900 bg-zinc-900 text-white font-bold"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {(q || category !== "all" || city !== "all" || when !== "all") && (
              <button
                onClick={() => { setQ(""); setCategory("all"); setCity("all"); setWhen("all"); }}
                className="btn btn-ghost text-sm text-zinc-600 hover:text-zinc-900 py-1.5 px-3"
              >
                <X className="h-4 w-4 mr-1" /> Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner label="Searching events..." />
      ) : events.length === 0 ? (
        <EmptyState
          title="No events matching criteria"
          body="Try adjusting your keywords or clearing category and city filters to find more events."
        />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((e, i) => (
              <EventCard key={e.slug} event={e} index={i} />
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-6 border-t border-zinc-200/80">
              <button
                className="btn btn-secondary text-sm py-2 px-4"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </button>
              <span className="text-sm font-bold text-zinc-700">
                Page {page} of {pages}
              </span>
              <button
                className="btn btn-secondary text-sm py-2 px-4"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<Spinner label="Loading events..." />}>
      <BrowseInner />
    </Suspense>
  );
}
