import Link from "next/link";
import { MapPin, Users, Zap } from "lucide-react";
import { fmtDate, fmtTime } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { CATEGORY_EMOJI } from "@/lib/format";

export type EventCardData = {
  slug: string;
  title: string;
  category: string;
  bannerUrl?: string | null;
  venueName: string;
  city: string;
  startsAt: string | Date;
  soldOut?: boolean;
  liveMode?: boolean;
  minPricePs?: number;
  soldPct?: number;
  organizer?: string;
  verified?: boolean;
};

const GRADIENTS = [
  "from-brand-500 to-purple-600",
  "from-rose-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-indigo-600",
  "from-amber-500 to-pink-600",
  "from-violet-500 to-fuchsia-600",
];

export function EventCard({ event, index = 0 }: { event: EventCardData; index?: number }) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  return (
    <Link
      href={`/events/${event.slug}`}
      className="card group overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-brand-200 dark:hover:border-brand-500/60 hover:shadow-pop"
    >
      <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${gradient}`}>
        {event.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.bannerUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-5xl opacity-80 transition duration-300 group-hover:scale-110">
            {CATEGORY_EMOJI[event.category] ?? "🎟️"}
          </div>
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
        <div className="absolute left-2 top-2 flex gap-1">
          <span className="chip bg-white/90 text-slate-700">{event.category}</span>
          {event.liveMode && (
            <span className="chip animate-pulseSoft bg-rose-600 text-white">
              <Zap className="h-3 w-3" /> LIVE
            </span>
          )}
        </div>
        {event.soldOut && (
          <span className="chip absolute right-2 top-2 bg-slate-900/80 text-white">Sold out</span>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        <div className="line-clamp-1 font-bold leading-tight transition group-hover:text-brand-700 dark:group-hover:text-brand-300">{event.title}</div>
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <MapPin className="h-3.5 w-3.5" /> {event.venueName}, {event.city}
        </div>
        <div className="text-xs font-semibold text-brand-700 dark:text-brand-300">
          {fmtDate(event.startsAt)} · {fmtTime(event.startsAt)}
        </div>
        <div className="flex items-center justify-between pt-1">
          {event.minPricePs !== undefined && event.minPricePs > 0 ? (
            <div className="text-sm">
              <span className="text-slate-500 dark:text-slate-400">from </span>
              <span className="font-bold">{fmtMoney(event.minPricePs)}</span>
            </div>
          ) : (
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-300">Free</div>
          )}
          {event.soldPct !== undefined && event.soldPct > 0 && (
            <span className="badge-amber">
              <Users className="h-3 w-3" /> {event.soldPct}% booked
            </span>
          )}
        </div>
        {event.organizer && (
          <div className="truncate border-t border-slate-100 dark:border-slate-800 pt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            by {event.organizer} {event.verified && <span className="text-emerald-600 dark:text-emerald-300">✓ verified</span>}
          </div>
        )}
      </div>
    </Link>
  );
}
