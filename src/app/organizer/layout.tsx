"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScanLine, Settings, Ticket, Plus } from "lucide-react";

const NAV = [
  { href: "/organizer", label: "Overview", icon: LayoutDashboard },
  { href: "/organizer/checkin", label: "Gate Check-in", icon: ScanLine },
  { href: "/organizer/settings", label: "Host Settings", icon: Settings },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col md:flex-row gap-6">
      <aside className="w-full md:w-56 shrink-0">
        <div className="card sticky top-20 p-3 bg-white border border-zinc-200/80 shadow-sm">
          <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Organizer Portal
          </div>
          <div className="space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  pathname === href
                    ? "bg-zinc-900 text-white font-semibold"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </Link>
            ))}
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <Link href="/organizer/events/new" className="btn btn-primary w-full text-xs py-2">
              <Plus className="h-3.5 w-3.5 mr-1" /> New Event
            </Link>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
