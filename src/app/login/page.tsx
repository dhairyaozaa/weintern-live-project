"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, User, Building2, Shield, ArrowRight } from "lucide-react";
import { Toast, Spinner } from "@/components/ui";

const DEMO_ACCOUNTS = [
  { role: "Customer", email: "customer@demo.io", icon: User },
  { role: "Organizer", email: "organizer@demo.io", icon: Building2 },
  { role: "Admin", email: "admin@demo.io", icon: Shield },
];

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  async function submit(e?: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setLoading(true);
    setToast(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds ?? { email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Authentication failed");
      const role = d.user.role as string;
      if (next !== "/") router.push(next);
      else if (role === "ADMIN") router.push("/admin");
      else if (role === "ORGANIZER") router.push("/organizer");
      else router.push("/browse");
      router.refresh();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Authentication failed", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 py-6">
      <div className="card p-6 sm:p-8 bg-white border border-zinc-200/80 shadow-card space-y-4">
        <div className="flex items-center gap-3.5 pb-2 border-b border-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="TicketFlow" className="h-11 w-11 object-contain rounded-xl shadow-xs shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Sign in</h1>
            <p className="mt-0.5 text-xs text-zinc-500">Access your digital tickets, saved events, and organizer tools</p>
          </div>
        </div>

        {toast && <Toast message={toast.msg} tone={toast.tone} />}

        <form onSubmit={submit} className="space-y-3.5 pt-1">
          <div>
            <label className="label">Email address</label>
            <input
              className="input text-xs"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              className="input text-xs"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full text-xs font-semibold py-2.5 mt-2"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Sign In to Account
          </button>
        </form>

        {/* Demo Fast Logins */}
        <div className="border-t border-zinc-100 pt-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Quick One-Click Demo Sign-in
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword("Password@123");
                    submit(undefined, { email: acc.email, password: "Password@123" });
                  }}
                  className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition text-center group"
                >
                  <Icon className="h-4 w-4 text-zinc-600 group-hover:text-zinc-900 mb-1" />
                  <span className="text-xs font-bold text-zinc-900">{acc.role}</span>
                  <span className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate max-w-full">
                    demo
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 text-center text-xs text-zinc-500">
          New to TicketFlow?{" "}
          <Link href="/register" className="font-semibold text-zinc-900 underline underline-offset-2">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner label="Loading sign-in..." />}>
      <LoginInner />
    </Suspense>
  );
}
