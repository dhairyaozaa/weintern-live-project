"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, ScanLine, Settings, Ticket } from "lucide-react";

const NAV = [
  { href: "/organizer", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organizer/checkin", label: "Check-in console", icon: ScanLine },
  { href: "/organizer/settings", label: "Settings", icon: Settings },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-6">
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="card sticky top-20 p-3">
          <div className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Organizer</div>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`mb-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                pathname === href ? "bg-brand-50 text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
          <div className="mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
            <Link href="/organizer/events/new" className="btn-primary w-full text-xs">
              <Ticket className="h-4 w-4" /> Create event
            </Link>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
