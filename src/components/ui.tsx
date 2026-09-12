export function StatCard({
  label,
  value,
  sub,
  accent = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "brand" | "green" | "amber" | "rose" | "slate";
}) {
  const accents: Record<string, string> = {
    brand: "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300",
    green: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
    rose: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  };
  return (
    <div className="card p-4">
      <div className={`chip ${accents[accent]} mb-2`}>{label}</div>
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="text-lg font-bold">{title}</div>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{body}</p>
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-brand-600" />
      {label ?? "Loading…"}
    </div>
  );
}

export function Toast({ message, tone = "error" }: { message: string; tone?: "error" | "success" | "info" }) {
  const tones = {
    error: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30",
    success: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30",
    info: "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-500/30",
  };
  return (
    <div className={`anim-toast rounded-lg border px-3 py-2 text-sm ${tones[tone]}`} role="status">
      {message}
    </div>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
      <div
        className={`anim-progress h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-500"}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}
