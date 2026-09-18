import Link from "next/link";
import {
  MapPin, Calendar, Users, Zap, Music, Terminal, Trophy, Mic,
  Drama, Utensils, Briefcase, Palette, Heart, Compass
} from "lucide-react";
import { fmtDate, fmtTime } from "@/lib/format";
import { fmtMoney } from "@/lib/money";

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

export function CategoryIcon({ category, className = "h-4 w-4" }: { category: string; className?: string }) {
  switch (category) {
    case "Music": return <Music className={className} />;
    case "Tech": return <Terminal className={className} />;
    case "Sports": return <Trophy className={className} />;
    case "Comedy": return <Mic className={className} />;
    case "Theatre": return <Drama className={className} />;
    case "Food": return <Utensils className={className} />;
    case "Business": return <Briefcase className={className} />;
    case "Art": return <Palette className={className} />;
    case "Wellness": return <Heart className={className} />;
    default: return <Compass className={className} />;
  }
}

export function EventCard({ event }: { event: EventCardData; index?: number }) {
  const isFree = !event.minPricePs || event.minPricePs === 0;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="card group flex flex-col overflow-hidden bg-white border border-zinc-200/90 hover:border-zinc-400 hover:shadow-md transition-all duration-200 rounded-2xl"
    >
      {/* Visual Asset Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 border-b border-zinc-100">
        {event.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.bannerUrl}
            alt={event.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 text-zinc-400">
            <CategoryIcon category={event.category} className="h-12 w-12 text-zinc-300 stroke-[1.25]" />
            <span className="text-xs font-bold tracking-wider uppercase text-zinc-500">{event.category}</span>
          </div>
        )}

        {/* Status badges */}
        <div className="absolute left-3.5 top-3.5 flex flex-wrap gap-2">
          <span className="chip bg-white/95 text-zinc-850 backdrop-blur shadow-sm border border-zinc-200/60 text-xs font-semibold px-3 py-1">
            {event.category}
          </span>
          {event.liveMode && (
            <span className="chip bg-rose-600 text-white font-bold flex items-center gap-1.5 shadow-sm text-xs px-2.5 py-1">
              <span className="h-1.5 w-1.5 bg-white shrink-0" />
              LIVE
            </span>
          )}
        </div>

        {event.soldOut && (
          <div className="absolute right-3.5 top-3.5">
            <span className="chip bg-zinc-900 text-white font-semibold text-xs px-3 py-1 shadow-sm">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
            <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
            <span>{fmtDate(event.startsAt)} · {fmtTime(event.startsAt)}</span>
          </div>

          <h3 className="line-clamp-2 text-lg font-extrabold text-zinc-900 leading-snug group-hover:text-brand-600 transition duration-150">
            {event.title}
          </h3>

          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="truncate">{event.venueName}, {event.city}</span>
          </div>
        </div>

        {/* Footer: Pricing and Availability */}
        <div className="flex items-end justify-between border-t border-zinc-100 pt-3.5">
          <div>
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block leading-tight mb-0.5">
              Tickets From
            </span>
            <span className="text-lg font-black text-zinc-900">
              {isFree ? "Free Admission" : fmtMoney(event.minPricePs!)}
            </span>
          </div>

          {event.soldPct !== undefined && !event.soldOut && (
            <span className="text-xs sm:text-sm font-semibold text-zinc-600">
              {event.soldPct > 80 ? (
                <span className="text-rose-600 font-bold">Almost full</span>
              ) : (
                <span>{100 - event.soldPct}% available</span>
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
