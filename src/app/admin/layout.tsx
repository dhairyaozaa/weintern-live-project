"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileClock, ScrollText, Settings, ShieldCheck, Ticket } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/organizers", label: "Organizers", icon: ShieldCheck },
  { href: "/admin/events", label: "Events", icon: Ticket },
  { href: "/admin/coupons", label: "Coupons", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit Log", icon: FileClock },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col md:flex-row gap-6">
      <aside className="w-full md:w-56 shrink-0">
        <div className="card sticky top-20 p-3 bg-white border border-zinc-200/80 shadow-sm">
          <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Platform Administration
          </div>
          <div className="space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const isActive = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
