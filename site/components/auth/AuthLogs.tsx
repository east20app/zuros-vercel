"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchAuthLogs } from "@/lib/actions/auth.actions";

interface AuthLogsProps {
  licenseId: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  category: string;
  action: string;
  user_id: string;
  username: string;
  result: string;
  details: string;
}

export default function AuthLogs({ licenseId }: AuthLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    startTransition(async () => {
      try {
        const r = await fetchAuthLogs(licenseId);
        if (r.ok) {
          setLogs(r.data.items as unknown as LogEntry[]);
          setError(null);
        } else {
          setError(r.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Falha ao carregar logs.");
      }
    });
  }, [licenseId]);

  const filtered = logs.filter((log) => {
    const matchesSearch =
      search === "" ||
      log.username.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.user_id.includes(search);
    const matchesCategory =
      categoryFilter === "all" || log.category === categoryFilter;
    const matchesResult =
      resultFilter === "all" || log.result === resultFilter;
    return matchesSearch && matchesCategory && matchesResult;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedLogs = filtered.slice((page - 1) * pageSize, page * pageSize);

  const categories = Array.from(new Set(logs.map((l) => l.category)));
  const results = Array.from(new Set(logs.map((l) => l.result)));

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 sm:p-6 text-red-300 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Auth Logs</h2>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by user, action, or ID..."
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => {
            setResultFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
        >
          <option value="all">All Results</option>
          {results.map((res) => (
            <option key={res} value={res}>
              {res}
            </option>
          ))}
        </select>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : paginatedLogs.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No logs found</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[.07]">
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Time</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Category</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Action</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">User</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Result</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-white/[.04] hover:bg-white/[.02]"
                  >
                    <td className="py-3 px-3 text-zinc-500 text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded-full bg-zinc-500/15 border border-zinc-500/30 px-2.5 py-0.5 text-[11px] text-zinc-300">
                        {log.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-300 text-xs">{log.action}</td>
                    <td className="py-3 px-3 text-zinc-400 text-xs">
                      {log.username || log.user_id}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                          log.result === "success"
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                            : log.result === "denied"
                            ? "bg-red-500/15 border-red-500/30 text-red-300"
                            : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-500 text-xs max-w-[200px] truncate">
                      {log.details || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
