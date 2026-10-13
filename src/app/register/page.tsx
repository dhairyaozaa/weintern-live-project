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
    <div className="mx-auto max-w-md py-6">
      <div className="card p-6 sm:p-8 bg-white border border-zinc-200/80 shadow-card space-y-4">
        <div className="flex items-center gap-3.5 pb-2 border-b border-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="TicketFlow" className="h-11 w-11 object-contain rounded-xl shadow-xs shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Create an account</h1>
            <p className="mt-0.5 text-xs text-zinc-500">Book tickets in seconds and manage digital passes</p>
          </div>
        </div>

        {toast && <Toast message={toast.msg} tone={toast.tone} />}

        <form onSubmit={submit} className="space-y-3.5 pt-1">
          <div>
            <label className="label">Full name</label>
            <input
              className="input text-xs"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya Chen"
            />
          </div>

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
            <label className="label">Password (min. 6 characters)</label>
            <input
              className="input text-xs"
              type="password"
              required
              minLength={6}
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
            Create Account
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-zinc-500 border-t border-zinc-100">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-zinc-900 underline underline-offset-2">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
