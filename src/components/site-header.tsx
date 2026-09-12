"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Bell, CalendarDays, LayoutDashboard, LogOut, Moon, Search, Shield, Sparkles, Sun, Ticket } from "lucide-react";
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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const btn = document.querySelector<HTMLButtonElement>('button[aria-label="Toggle dark mode"]');

    const apply = () => {
      root.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("theme", next);
      } catch {}
      setTheme(next);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    if (!doc.startViewTransition || reduced) {
      apply();
      return;
    }
    const rect = btn?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    doc.startViewTransition(() => {
      flushSync(apply);
    });
  }

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

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur no-print">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Ticket className="h-5 w-5" />
          </span>
          <span className="text-lg">
            Ticket<span className="text-brand-600">Flow</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
          <Link href="/browse" className={`rounded-lg px-3 py-2 hover:bg-slate-100 ${pathname === "/browse" ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100" : ""}`}>
            Browse events
          </Link>
          {me?.role === "CUSTOMER" && (
            <Link
              href="/organizer/onboarding"
              className="flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-slate-100"
            >
              <Sparkles className="h-4 w-4 text-brand-600" /> Become an organizer
            </Link>
          )}
          {(me?.role === "ORGANIZER" || me?.role === "ADMIN") && (
            <Link href="/organizer" className={`flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-slate-100 ${pathname.startsWith("/organizer") ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100" : ""}`}>
              <LayoutDashboard className="h-4 w-4" /> Organizer
            </Link>
          )}
          {me?.role === "ADMIN" && (
            <Link href="/admin" className={`flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-slate-100 ${pathname.startsWith("/admin") ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100" : ""}`}>
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>

        <form
          className="ml-auto hidden max-w-xs flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/browse?q=${encodeURIComponent(q)}`);
          }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events, venues…"
              className="input pl-9"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button
            onClick={toggleTheme}
            className="btn-ghost px-2"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : me ? (
            <>
              <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-slate-100" title="Notifications">
                <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/bookings" className="btn-secondary" title="My bookings">
                <CalendarDays className="h-4 w-4" /> <span className="hidden sm:inline">Bookings</span>
              </Link>
              <div className="hidden text-right sm:block">
                <div className="max-w-[140px] truncate text-sm font-semibold leading-4">{me.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{me.role.toLowerCase()}</div>
              </div>
              <button onClick={logout} className="btn-ghost px-2" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-secondary">Sign in</Link>
              <Link href="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
