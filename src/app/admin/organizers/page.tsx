"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { Spinner, Toast } from "@/components/ui";

type Organizer = {
  id: string; userId: string; orgName: string; name: string; email: string; status: string;
  platformFeeBps: number; events: number; grossPs: number; joinedAt: string;
};

export default function AdminOrganizers() {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/organizers", { cache: "no-store" });
    const d = await res.json();
    setOrganizers(d.organizers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(userId: string, action: string, feeBps?: number) {
    setBusy(userId);
    try {
      const res = await fetch("/api/admin/organizers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, feeBps }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToast({ msg: "Updated ✓", tone: "success" });
      load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner label="Loading organizers…" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Organizers</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Verification queue and commission overrides</p>
      </div>
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      <div className="space-y-3">
        {organizers.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{o.orgName}</span>
                  {o.status === "VERIFIED" && <span className="badge-green"><ShieldCheck className="h-3 w-3" /> verified</span>}
                  {o.status === "PENDING" && <span className="badge-amber">pending review</span>}
                  {o.status === "REJECTED" && <span className="badge-red">rejected</span>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {o.name} · {o.email} · joined {fmtDate(o.joinedAt)}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {o.events} events · gross {fmtMoney(o.grossPs)} · commission {(o.platformFeeBps / 100).toFixed(1)}%
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {o.status !== "VERIFIED" && (
                  <button className="btn-primary py-1.5 text-xs" disabled={busy === o.userId} onClick={() => act(o.userId, "verify")}>
                    {busy === o.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify
                  </button>
                )}
                {o.status === "PENDING" && (
                  <button className="btn-secondary py-1.5 text-xs" disabled={busy === o.userId} onClick={() => act(o.userId, "reject")}>
                    Reject
                  </button>
                )}
                <FeeEditor current={o.platformFeeBps} onSave={(bps) => act(o.userId, "setFee", bps)} />
              </div>
            </div>
          </div>
        ))}
        {organizers.length === 0 && <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">No organizers yet.</div>}
      </div>
    </div>
  );
}

function FeeEditor({ current, onSave }: { current: number; onSave: (bps: number) => void }) {
  const [value, setValue] = useState(String(current / 100));
  return (
    <div className="flex items-center gap-1">
      <input
        className="input w-20 py-1.5 text-xs"
        type="number"
        step="0.5"
        min={0}
        max={30}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        title="Commission %"
      />
      <span className="text-xs text-slate-400 dark:text-slate-500">%</span>
      <button className="btn-ghost text-xs" onClick={() => onSave(Math.round(Number(value) * 100))}>
        Set fee
      </button>
    </div>
  );
}
