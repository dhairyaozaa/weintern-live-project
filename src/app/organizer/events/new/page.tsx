"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/format";
import { Toast } from "@/components/ui";

type TierForm = { name: string; description: string; price: string; capacity: string; perUserLimit: string };

const DEFAULT_TIERS: TierForm[] = [
  { name: "Early Bird", description: "Limited early bird batch", price: "499", capacity: "100", perUserLimit: "4" },
  { name: "General", description: "Regular admission", price: "799", capacity: "400", perUserLimit: "6" },
  { name: "VIP", description: "Front rows + merch", price: "1499", capacity: "50", perUserLimit: "4" },
];

export default function NewEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Music");
  const [bannerUrl, setBannerUrl] = useState("");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("22:00");
  const [pricingMode, setPricingMode] = useState<"STATIC" | "EARLY_BIRD" | "DEMAND">("STATIC");
  const [ebDate, setEbDate] = useState("");
  const [tiers, setTiers] = useState<TierForm[]>(DEFAULT_TIERS);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);

  function updateTier(i: number, patch: Partial<TierForm>) {
    setTiers((t) => t.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function submit() {
    setSubmitting(true);
    setToast(null);
    try {
      if (!date) throw new Error("Pick an event date");
      const startsAt = new Date(`${date}T${start}:00`);
      const endsAt = new Date(`${date}T${end}:00`);
      if (endsAt <= startsAt) throw new Error("End time must be after start time");
      if (tiers.length < 1) throw new Error("Add at least one ticket tier");

      const res = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          bannerUrl: bannerUrl || undefined,
          venueName,
          city,
          address: address || undefined,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          pricingMode,
          earlyBirdEnds:
            pricingMode === "EARLY_BIRD" && ebDate ? new Date(`${ebDate}T23:59:59`).toISOString() : null,
          tiers: tiers.map((t) => ({
            name: t.name,
            description: t.description || undefined,
            price: Number(t.price),
            capacity: Number(t.capacity),
            perUserLimit: Number(t.perUserLimit) || 6,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not create event");
      router.push(`/organizer/events/${d.event.id}`);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Create an event</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Set up details, pricing and inventory — publish when ready</p>
      </div>
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-semibold">
        {["Basics", "When & where", "Tickets"].map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i + 1)}
            className={`chip border ${step === i + 1 ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400"}`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="card space-y-4 p-5">
        {step === 1 && (
          <>
            <div>
              <label className="label">Event title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Indie Nights Vol. 3" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's happening? Lineup, highlights, FAQs…" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Category</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Banner image URL (optional)</label>
                <input className="input" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://images.unsplash.com/…" />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Venue name</label>
                <input className="input" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Fiddlesticks Arena" />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
              </div>
            </div>
            <div>
              <label className="label">Street address (optional)</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123, MG Road" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <label className="label">Starts</label>
                <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label className="label">Ends</label>
                <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="label">Pricing mode</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  ["STATIC", "Static", "One price, no changes"],
                  ["EARLY_BIRD", "Early bird", "Cheaper until a cutoff date, then steps up"],
                  ["DEMAND", "Dynamic", "Revise prices anytime with a floor"],
                ] as const).map(([mode, label, hint]) => (
                  <button
                    type="button"
                    key={mode}
                    onClick={() => setPricingMode(mode)}
                    className={`rounded-lg border p-3 text-left text-sm ${pricingMode === mode ? "border-brand-600 bg-brand-50 dark:bg-brand-500/15" : "border-slate-200 dark:border-slate-800"}`}
                  >
                    <div className="font-bold">{label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{hint}</div>
                  </button>
                ))}
              </div>
            </div>
            {pricingMode === "EARLY_BIRD" && (
              <div>
                <label className="label">Early-bird ends on</label>
                <input className="input" type="date" value={ebDate} onChange={(e) => setEbDate(e.target.value)} />
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">After this date, prices step up automatically on the event page.</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label mb-0">Ticket tiers</label>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => setTiers([...tiers, { name: "", description: "", price: "", capacity: "", perUserLimit: "6" }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add tier
                </button>
              </div>
              {tiers.map((tier, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3 sm:grid-cols-[1fr_1fr_100px_100px_90px_40px]">
                  <input className="input" placeholder="Tier name" value={tier.name} onChange={(e) => updateTier(i, { name: e.target.value })} />
                  <input className="input" placeholder="Perks (optional)" value={tier.description} onChange={(e) => updateTier(i, { description: e.target.value })} />
                  <input className="input" type="number" min={0} placeholder="₹ price" value={tier.price} onChange={(e) => updateTier(i, { price: e.target.value })} />
                  <input className="input" type="number" min={1} placeholder="Qty" value={tier.capacity} onChange={(e) => updateTier(i, { capacity: e.target.value })} />
                  <input className="input" type="number" min={1} title="Per-customer limit" value={tier.perUserLimit} onChange={(e) => updateTier(i, { perUserLimit: e.target.value })} />
                  <button type="button" className="btn-ghost px-2" onClick={() => setTiers(tiers.filter((_, idx) => idx !== i))} disabled={tiers.length <= 1}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-slate-400 dark:text-slate-500">Columns: name · perks · price (₹) · quantity · max per customer</p>
            </div>
          </>
        )}

        <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
          <button className="btn-secondary" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>← Back</button>
          {step < 3 ? (
            <button className="btn-primary" onClick={() => setStep(step + 1)}>Next →</button>
          ) : (
            <button className="btn-primary" onClick={submit} disabled={submitting || !title || !description || !venueName}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create event (draft)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
