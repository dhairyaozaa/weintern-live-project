export function StatCard({
  label,
  value,
  sub,
  accent = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "brand" | "green" | "amber" | "rose" | "slate";
}) {
  const accents: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 border-brand-200/60",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
    amber: "bg-amber-50 text-amber-800 border-amber-200/60",
    rose: "bg-rose-50 text-rose-800 border-rose-200/60",
    slate: "bg-zinc-100 text-zinc-700 border-zinc-200/60",
  };
  return (
    <div className="card p-5 bg-white border border-zinc-200/80">
      <div className={`chip ${accents[accent]} mb-2.5 border`}>{label}</div>
      <div className="text-2xl font-extrabold tracking-tight text-zinc-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
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
    <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center bg-white border border-zinc-200/80">
      <div className="text-base font-bold text-zinc-900">{title}</div>
      <p className="max-w-md text-xs text-zinc-500 leading-relaxed">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-xs font-medium text-zinc-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      {label ?? "Loading..."}
    </div>
  );
}

export function Toast({ message, tone = "error" }: { message: string; tone?: "error" | "success" | "info" }) {
  const tones = {
    error: "bg-rose-50 text-rose-800 border-rose-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    info: "bg-zinc-100 text-zinc-800 border-zinc-200",
  };
  return (
    <div className={`anim-toast rounded-lg border px-3.5 py-2.5 text-xs font-medium ${tones[tone]}`} role="status">
      {message}
    </div>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 ${className}`}>
      <div
        className="anim-progress h-full bg-zinc-900"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
