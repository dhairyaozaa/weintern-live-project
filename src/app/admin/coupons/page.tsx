"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { fmtMoney } from "@/lib/money";
import { Spinner, Toast } from "@/components/ui";

type Coupon = {
  id: string; code: string; discountType: string; value: number; maxDiscountPs: number | null;
  minOrderPs: number; redemptionCount: number; maxRedemptions: number | null; active: boolean;
  expiresAt: string | null; label: string;
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null);
  const [form, setForm] = useState({ code: "", discountType: "PERCENT", value: "10", minOrder: "0", maxDiscount: "", maxRedemptions: "", perUserLimit: "1", expiresAt: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/coupons", { cache: "no-store" });
    const d = await res.json();
    setCoupons(d.coupons ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          value: Number(form.value),
          minOrder: Number(form.minOrder) || 0,
          maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
          perUserLimit: Number(form.perUserLimit) || 1,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToast({ msg: `${form.code.toUpperCase()} created`, tone: "success" });
      setForm({ code: "", discountType: "PERCENT", value: "10", minOrder: "0", maxDiscount: "", maxRedemptions: "", perUserLimit: "1", expiresAt: "" });
      load();
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", tone: "error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Global coupons</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Platform-wide discounts, applicable at any event checkout</p>
      </div>
      {toast && <Toast message={toast.msg} tone={toast.tone} />}

      <div className="card space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <input className="input" placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <select className="input" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
            <option value="PERCENT">% off</option>
            <option value="FLAT">₹ flat off</option>
          </select>
          <input className="input" type="number" placeholder={form.discountType === "PERCENT" ? "Value (%)" : "Value (₹)"} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <input className="input" type="number" placeholder="Min order ₹" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
          <input className="input" type="number" placeholder="Max discount ₹ (optional)" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
          <input className="input" type="number" placeholder="Max total uses" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
          <input className="input" type="number" placeholder="Per-user limit" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
          <input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
        </div>
        <button className="btn-primary" onClick={create} disabled={creating || !form.code || !form.value}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create coupon
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <span className="font-mono text-base font-bold">{c.code}</span>
                <span className="ml-2 text-slate-600 dark:text-slate-300">{c.label}</span>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  min order {fmtMoney(c.minOrderPs)} · {c.redemptionCount}{c.maxRedemptions ? `/${c.maxRedemptions}` : ""} used
                  {c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString("en-IN")}` : ""}
                </div>
              </div>
              <button
                className={`chip ${c.active ? "badge-green" : "badge-slate"}`}
                onClick={async () => {
                  await fetch("/api/admin/coupons", {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: c.id, active: !c.active }),
                  });
                  load();
                }}
              >
                {c.active ? "active" : "paused"}
              </button>
            </div>
          ))}
          {coupons.length === 0 && <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">No global coupons yet.</div>}
        </div>
      )}
    </div>
  );
}
