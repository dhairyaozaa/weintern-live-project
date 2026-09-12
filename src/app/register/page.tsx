"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Toast } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setToast(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Registration failed");
      router.push("/browse");
      router.refresh();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Registration failed", tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="text-xl font-extrabold">Create your account</h1>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Book tickets in seconds — no card needed to sign up</p>
        {toast && <div className="mb-3"><Toast message={toast.msg} tone={toast.tone} /></div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <input className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account? <Link href="/login" className="font-semibold text-brand-700 dark:text-brand-300 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
