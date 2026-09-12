"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type FeedItem = {
  id: string;
  name: string;
  title: string;
  slug: string;
  at: string;
};

function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateArrows();

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const max = el.scrollWidth - el.clientWidth;
        const target = el.scrollLeft + e.deltaY;
        if ((el.scrollLeft > 0 && e.deltaY < 0) || (el.scrollLeft < max && e.deltaY > 0)) {
          e.preventDefault();
          el.scrollTo({ left: target, behavior: "auto" });
        }
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.classList.add("cursor-grabbing", "select-none");
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    };
    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
      el.classList.remove("cursor-grabbing", "select-none");
    };
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    };
    const onScroll = () => updateArrows();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateArrows);

    const t = setTimeout(updateArrows, 300);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateArrows);
      clearTimeout(t);
    };
  }, [updateArrows]);

  const nudge = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: "smooth" });
  }, []);

  return { ref, canLeft, canRight, nudge };
}

function initials(name: string) {
  return name.slice(0, 1).toUpperCase();
}

function Ago({ at }: { at: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(at).getTime()) / 1000));
  const label =
    s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
  return <span className="shrink-0 text-slate-400 dark:text-slate-500">{label}</span>;
}

export function LiveFeed({ initial }: { initial: FeedItem[] }) {
  const [items, setItems] = useState<FeedItem[]>(initial);
  const { ref, canLeft, canRight, nudge } = useDragScroll();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/bookings/recent", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data.bookings)) setItems(data.bookings);
      } catch {}
    };
    const t = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Happening right now
          </h2>
          <span className="badge-green hidden sm:inline-flex">live</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => nudge(-1)}
            disabled={!canLeft}
            className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm transition hover:border-brand-300 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 disabled:cursor-default disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => nudge(1)}
            disabled={!canRight}
            className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm transition hover:border-brand-300 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 disabled:cursor-default disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="scroll-x relative">
        <div ref={ref} className="scroll-x-track flex cursor-grab gap-2 overflow-x-auto pb-1">
          {items.map((b, i) => (
            <Link
              key={b.id}
              href={`/events/${b.slug}`}
              className="anim-feed-chip card flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 text-xs transition hover:border-brand-300 dark:hover:border-brand-500/60 hover:shadow-card"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                {initials(b.name)}
              </span>
              <span>
                <b>{b.name}</b> booked <span className="font-semibold">{b.title}</span>
              </span>
              <Ago at={b.at} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
