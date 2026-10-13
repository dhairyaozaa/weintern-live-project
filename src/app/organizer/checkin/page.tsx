"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScanLine, Search, Zap } from "lucide-react";
import { fmtDate, fmtTime } from "@/lib/format";
import { Spinner, Toast } from "@/components/ui";

type GateEvent = {
  id: string; title: string; startsAt: string; liveMode: boolean; status: string;
  total: number; checkedIn: number;
};

type ScanResult = {
  alreadyCheckedIn: boolean;
  checkedInAt: string;
  attendee: string;
  tier: string;
  seat: string | null;
};

export default function CheckinConsole() {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [result, setResult] = useState<(ScanResult & { ok: boolean; message: string }) | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/checkin", { cache: "no-store" });
    const d = await res.json();
    setEvents(d.events ?? []);
    setLoading(false);
    return d.events as GateEvent[] | undefined;
  }, []);

  useEffect(() => {
    load().then((evts) => {
      if (evts?.length && !selected) setSelected(evts[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh stats periodically
  useEffect(() => {
    const t = setInterval(() => load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  async function scan(payload: string) {
    if (!payload.trim() || !selected) return;
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, eventId: selected }),
      });
      const d = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: d.error || "Invalid ticket", alreadyCheckedIn: false, checkedInAt: "", attendee: "", tier: "", seat: null });
      } else if (d.alreadyCheckedIn) {
        setResult({ ok: false, message: `Already checked in at ${fmtTime(d.checkedInAt)}`, alreadyCheckedIn: true, checkedInAt: d.checkedInAt, attendee: d.attendee, tier: d.tier, seat: d.seat });
      } else {
        setResult({ ok: true, message: `Welcome, ${d.attendee}!`, ...d });
      }
    } catch {
      setResult({ ok: false, message: "Scan failed — try again", alreadyCheckedIn: false, checkedInAt: "", attendee: "", tier: "", seat: null });
    }
    // refresh stats
    load();
  }

  async function manualLookup() {
    if (!manual.trim()) return;
    const res = await fetch("/api/checkin/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: manual.trim() }),
    });
    const d = await res.json();
    if (!res.ok) {
      setResult({ ok: false, message: d.error || "Not found", alreadyCheckedIn: false, checkedInAt: "", attendee: "", tier: "", seat: null });
      return;
    }
    // Auto check-in first valid ticket
    await scan(d.tickets[0].qrPayload);
  }

  if (loading) return <Spinner label="Loading gate console…" />;

  const current = events.find((e) => e.id === selected);
  const scanPct = current && current.total > 0 ? Math.round((current.checkedIn / current.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ScanLine className="h-6 w-6 text-brand-600" /> Check-in console</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Scan attendee QR passes at the gate — works on phone cameras too</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Scanner */}
        <div className="card space-y-4 p-5">
          <div>
            <label className="label">Event</label>
            <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {fmtDate(e.startsAt)} ({e.checkedIn}/{e.total} in)
                </option>
              ))}
            </select>
          </div>

          <div
            className={`grid place-items-center rounded-xl border-2 border-dashed p-8 text-center transition ${
              result?.ok ? "border-emerald-400 bg-emerald-50" : result ? "border-rose-300 bg-rose-50" : "border-slate-200 dark:border-slate-800 bg-slate-50"
            }`}
          >
            {result ? (
              <div>
                <div className="text-4xl">{result.ok ? "✅" : result.alreadyCheckedIn ? "⚠️" : "❌"}</div>
                <div className={`mt-2 text-lg font-extrabold ${result.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{result.message}</div>
                {result.attendee && (
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {result.attendee} · {result.tier} · Seat {result.seat}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <ScanLine className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">Scan result appears here</p>
              </div>
            )}
          </div>

          {/* Keyboard-wedge / USB scanner input — also works pasting the QR payload */}
          <form
            onSubmit={(e) => { e.preventDefault(); scan(inputRef.current?.value ?? ""); if (inputRef.current) inputRef.current.value = ""; }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              className="input font-mono"
              placeholder="Paste QR payload (TF1.xxxx.yyyy) or use a USB scanner"
              autoFocus
            />
            <button className="btn-primary" type="submit">Verify</button>
          </form>

          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Or look up by booking ref / email / name"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
            <button className="btn-secondary" onClick={manualLookup}>
              <Search className="h-4 w-4" /> Find
            </button>
          </div>
        </div>

        {/* Live stats */}
        <div className="space-y-3">
          {current && (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold">Live entry stats</div>
                {current.liveMode && <span className="badge-red animate-pulseSoft"><Zap className="h-3 w-3" /> LIVE</span>}
              </div>
              <div className="mt-2 text-3xl font-extrabold">{current.checkedIn}<span className="text-lg text-slate-400 dark:text-slate-500">/{current.total}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${scanPct}%` }} />
              </div>
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{scanPct}% through the gate</div>
            </div>
          )}
          <div className="card p-4 text-xs text-slate-500 dark:text-slate-400">
            <div className="mb-1 font-bold text-slate-700 dark:text-slate-200">Gate tips</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>Each QR can only check in once — re-scans are flagged, not silently rejected.</li>
              <li>Use the lookup box if a buyer forgot their QR — search by email or booking ref.</li>
              <li>Turn on “Go live” from the event dashboard to mark the event as happening now.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
