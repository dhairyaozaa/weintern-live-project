"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Spinner, Toast } from "@/components/ui";

type Settings = { feeBps: number; convenienceBps: number };

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeBps: settings.feeBps, convenienceBps: settings.convenienceBps }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSettings(d.settings);
      setToast({ msg: "Settings saved — applies to new bookings", tone: "success" });
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Platform settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Commissions and buyer fees</p>
      </div>
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Platform commission — % of organizer sales</label>
          <div className="flex items-center gap-2">
            <input
              className="input w-32"
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={settings!.feeBps / 100}
              onChange={(e) => setSettings({ ...settings!, feeBps: Math.round(Number(e.target.value) * 100) })}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">%</span>
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Earned on every confirmed booking. Per-organizer overrides available on the Organizers page.</p>
        </div>
        <div>
          <label className="label">Convenience fee — % added to buyer total</label>
          <div className="flex items-center gap-2">
            <input
              className="input w-32"
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={settings!.convenienceBps / 100}
              onChange={(e) => setSettings({ ...settings!, convenienceBps: Math.round(Number(e.target.value) * 100) })}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">%</span>
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Shown to buyers as a separate line at checkout.</p>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save settings
        </button>
      </div>
    </div>
  );
}
