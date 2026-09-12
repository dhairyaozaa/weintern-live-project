"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { fmtMoney } from "@/lib/money";
import { Spinner, Toast } from "@/components/ui";

type Profile = {
  orgName: string; about: string | null; supportEmail: string | null; supportPhone: string | null;
  upiId: string | null; status: string; platformFeeBps: number; events: number; grossPs: number;
};

export default function OrganizerSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/organizer/profile", { cache: "no-store" });
    const d = await res.json();
    setProfile(d.profile);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/organizer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: profile.orgName,
          about: profile.about ?? "",
          supportEmail: profile.supportEmail ?? undefined,
          supportPhone: profile.supportPhone ?? undefined,
          upiId: profile.upiId ?? undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToast({ msg: "Profile saved", tone: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!profile) return <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">No organizer profile found.</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">Organizer settings</h1>

      <div className="card flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {profile.status === "VERIFIED" ? (
            <span className="badge-green"><ShieldCheck className="h-4 w-4" /> Verified organizer</span>
          ) : profile.status === "PENDING" ? (
            <span className="badge-amber">Verification pending</span>
          ) : (
            <span className="badge-red">Verification declined</span>
          )}
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          {profile.events} events · {fmtMoney(profile.grossPs)} gross
        </div>
      </div>

      {toast && <Toast message={toast.msg} tone={toast.tone} />}
      <form onSubmit={save} className="card space-y-3 p-5">
        <div>
          <label className="label">Organization name</label>
          <input className="input" value={profile.orgName} onChange={(e) => setProfile({ ...profile, orgName: e.target.value })} />
        </div>
        <div>
          <label className="label">About</label>
          <textarea className="input" rows={3} value={profile.about ?? ""} onChange={(e) => setProfile({ ...profile, about: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Support email</label>
            <input className="input" type="email" value={profile.supportEmail ?? ""} onChange={(e) => setProfile({ ...profile, supportEmail: e.target.value })} />
          </div>
          <div>
            <label className="label">Support phone</label>
            <input className="input" value={profile.supportPhone ?? ""} onChange={(e) => setProfile({ ...profile, supportPhone: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Payout UPI ID</label>
          <input className="input" value={profile.upiId ?? ""} onChange={(e) => setProfile({ ...profile, upiId: e.target.value })} placeholder="yourname@upi" />
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-500 dark:text-slate-400">
          Platform commission on your sales: <b>{(profile.platformFeeBps / 100).toFixed(1)}%</b> (set by the platform).
        </div>
        <button className="btn-primary" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save profile
        </button>
      </form>
    </div>
  );
}
