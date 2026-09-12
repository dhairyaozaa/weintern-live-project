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
  { href: "/admin/audit", label: "Audit log", icon: FileClock },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-6">
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="card sticky top-20 p-3">
          <div className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Platform admin</div>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`mb-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href))
                  ? "bg-brand-50 text-brand-700 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
