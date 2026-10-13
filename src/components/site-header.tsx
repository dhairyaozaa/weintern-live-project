"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CalendarDays, LayoutDashboard, LogOut, Search, Shield, Ticket, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type Me = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ORGANIZER" | "ADMIN";
  organizer: { orgName: string; status: string } | null;
} | null;

export function useMe() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setMe(data.user);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { me, loading, refresh };
}

export function SiteHeader() {
  const { me, loading, refresh } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!me) return;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { unread: 0 }))
      .then((d) => setUnread(d.unread ?? 0))
      .catch(() => {});
  }, [me, pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refresh();
    router.push("/");
    router.refresh();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/browse?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="sticky top-0 z-40 h-20 border-b border-zinc-200/80 bg-white/95 backdrop-blur no-print">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        {/* Left: Brand logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 font-bold tracking-tight text-zinc-900 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.webp"
              alt="TicketFlow"
              className="h-9 w-9 sm:h-10 sm:w-10 object-contain rounded-xl transition duration-200 group-hover:scale-105 shadow-xs"
            />
            <span className="text-xl font-extrabold tracking-tight">TicketFlow</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-zinc-600">
            <Link
              href="/browse"
              className={`transition hover:text-zinc-900 ${pathname === "/browse" ? "text-zinc-900 font-bold" : ""}`}
            >
              Browse Events
            </Link>
            <Link
              href="/organizer/onboarding"
              className={`transition hover:text-zinc-900 ${pathname?.startsWith("/organizer") ? "text-zinc-900 font-bold" : ""}`}
            >
              Host an Event
            </Link>
          </nav>
        </div>

        {/* Center: Search input */}
        <form onSubmit={handleSearch} className="hidden sm:block flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-zinc-400" />
            <input
              type="search"
              placeholder="Search concerts, festivals, conferences..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/80 py-2 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        </form>

        {/* Right: Actions / Auth */}
        <div className="flex items-center gap-3">
          {me ? (
            <>
              {me.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="btn btn-secondary text-sm py-2 px-3.5"
                  title="Admin Dashboard"
                >
                  <Shield className="h-4 w-4 text-brand-600 mr-1" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}
              {me.role === "ORGANIZER" && (
                <Link
                  href="/organizer"
                  className="btn btn-secondary text-sm py-2 px-3.5"
                  title="Organizer Dashboard"
                >
                  <LayoutDashboard className="h-4 w-4 text-zinc-700 mr-1" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              )}

              <Link
                href="/bookings"
                className="btn btn-ghost text-sm py-2 px-3"
                title="My Bookings"
              >
                <CalendarDays className="h-4.5 w-4.5 text-zinc-600 mr-1.5" />
                <span className="hidden sm:inline">My Tickets</span>
              </Link>

              <Link
                href="/notifications"
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white shadow-sm">
                    {unread}
                  </span>
                )}
              </Link>

              <div className="flex items-center gap-3 pl-3 border-l border-zinc-200">
                <div className="hidden lg:block text-right">
                  <div className="text-sm font-bold text-zinc-900 leading-tight">{me.name}</div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{me.role.toLowerCase()}</div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                  title="Sign out"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              </div>
            </>
          ) : !loading ? (
            <div className="flex items-center gap-2.5">
              <Link href="/login" className="btn btn-ghost text-sm py-2 px-4">
                Sign In
              </Link>
              <Link href="/register" className="btn btn-primary text-sm py-2 px-4.5">
                Get Started
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
