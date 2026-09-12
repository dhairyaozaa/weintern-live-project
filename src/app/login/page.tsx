"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Toast } from "@/components/ui";

const DEMO_ACCOUNTS = [
  { label: "👤 Customer demo", email: "customer@demo.io" },
  { label: "🎪 Organizer demo", email: "organizer@demo.io" },
  { label: "🛡️ Admin demo", email: "admin@demo.io" },
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
      if (!res.ok) throw new Error(d.error || "Login failed");
      const role = d.user.role as string;
      if (next !== "/") router.push(next);
      else if (role === "ADMIN") router.push("/admin");
      else if (role === "ORGANIZER") router.push("/organizer");
      else router.push("/browse");
      router.refresh();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Login failed", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card p-6">
        <h1 className="text-xl font-extrabold">Welcome back</h1>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Sign in to book tickets and manage events</p>
        {toast && <div className="mb-3"><Toast message={toast.msg} tone={toast.tone} /></div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          New here? <Link href="/register" className="font-semibold text-brand-700 dark:text-brand-300 hover:underline">Create an account</Link>
        </p>
      </div>

      <div className="card p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Demo accounts (one-click)</div>
        <div className="grid gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              className="btn-secondary justify-between"
              disabled={loading}
              onClick={() => submit(undefined, { email: acc.email, password: "Password@123" })}
            >
              <span>{acc.label}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{acc.email}</span>
            </button>
          ))}
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">All demo passwords: Password@123</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
