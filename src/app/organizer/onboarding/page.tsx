"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useMe } from "@/components/site-header";
import { Toast } from "@/components/ui";

export default function OrganizerOnboardingPage() {
  const router = useRouter();
  const { me, loading, refresh } = useMe();
  const [orgName, setOrgName] = useState("");
  const [about, setAbout] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!loading && me?.role === "ORGANIZER") router.replace("/organizer");
  }, [me, loading, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const res = await fetch("/api/organizer/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, about: about || undefined, supportEmail: supportEmail || undefined, supportPhone: supportPhone || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      await refresh();
      router.push("/organizer");
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="text-center">
        <div className="text-4xl">🎪</div>
        <h1 className="mt-1 text-2xl font-extrabold">Become an organizer</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Publish events, sell tickets and scan QR passes — all free to set up</p>
      </div>
      {toast && <Toast message={toast.msg} tone={toast.tone} />}
      <form onSubmit={submit} className="card space-y-3 p-6">
        <div>
          <label className="label">Organization / brand name</label>
          <input className="input" required minLength={2} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Sunburn Productions" />
        </div>
        <div>
          <label className="label">About (shown on your events)</label>
          <textarea className="input" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="We've been throwing unforgettable nights since 2019…" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Support email</label>
            <input className="input" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="help@yourbrand.com" />
          </div>
          <div>
            <label className="label">Support phone</label>
            <input className="input" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="+91 98…" />
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-500 dark:text-slate-400">
          ℹ️ New organizers start unverified. Get verified by the platform team to earn the ✓ badge on your events
          (admins review under Admin → Organizers).
        </div>
        <button className="btn-primary w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Create organizer account
        </button>
      </form>
    </div>
  );
}
