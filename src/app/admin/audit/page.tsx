"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmtDateTime, prettyStatus } from "@/lib/format";
import { Spinner } from "@/components/ui";

type Log = {
  id: string; action: string; entity: string; entityId: string | null;
  metadata: Record<string, unknown> | null;
  actor: { name: string; email: string; role: string } | null;
  createdAt: string;
};

export default function AdminAudit() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/audit-logs?page=${page}&take=50`, { cache: "no-store" });
    const d = await res.json();
    setLogs(d.logs ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Audit log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Every privileged action, immutably recorded</p>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="card overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Entity</th>
                  <th className="px-4 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-4 py-2 text-xs">
                      {l.actor ? (
                        <>
                          <div className="font-medium">{l.actor.name}</div>
                          <div className="text-slate-400 dark:text-slate-500">{l.actor.role.toLowerCase()}</div>
                        </>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">system</span>
                      )}
                    </td>
                    <td className="px-4 py-2"><span className="badge-blue">{l.action}</span></td>
                    <td className="px-4 py-2 text-xs">
                      {l.entity}
                      {l.entityId && <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{l.entityId.slice(0, 12)}…</div>}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {l.metadata ? JSON.stringify(l.metadata) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-2 text-sm">
            <span className="text-xs text-slate-500 dark:text-slate-400">{total} entries</span>
            <div className="flex items-center gap-2">
              <button className="btn-ghost px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs">Page {page} / {pages || 1}</span>
              <button className="btn-ghost px-2" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
