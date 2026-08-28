"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { fetchAuthStats } from "@/lib/actions/auth.actions";

interface AuthOverviewProps {
  licenseId: string;
}

interface AuthStats {
  total_verified: number;
  new_today: number;
  success_rate: number;
  pending_role_syncs: number;
  gifts_active: number;
  recovery_running: number;
  daily_data: { date: string; count: number }[];
}

export default function AuthOverview({ licenseId }: AuthOverviewProps) {
  const [stats, setStats] = useState<AuthStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadStats = useCallback(() => {
    startTransition(async () => {
      try {
        const r = await fetchAuthStats(licenseId);
        if (r.ok) {
          setStats(r.data as unknown as AuthStats);
          setError(null);
        } else {
          setError(r.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Falha ao carregar estatísticas.");
      }
    });
  }, [licenseId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 sm:p-6 space-y-3">
        <p className="text-red-300 text-sm">{error}</p>
        <button onClick={loadStats} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300 hover:bg-red-500/20">Tentar novamente</button>
      </div>
    );
  }

  if (isPending || !stats) {
    return (
      <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-white/5" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total Verified", value: stats.total_verified, color: "text-emerald-300" },
    { label: "New Today", value: stats.new_today, color: "text-violet-300" },
    { label: "Success Rate", value: `${stats.success_rate}%`, color: "text-emerald-300" },
    { label: "Pending Role Syncs", value: stats.pending_role_syncs, color: "text-amber-300" },
    { label: "Gifts Active", value: stats.gifts_active, color: "text-violet-300" },
    { label: "Recovery Running", value: stats.recovery_running, color: stats.recovery_running > 0 ? "text-amber-300" : "text-zinc-400" },
  ];

  const maxCount = Math.max(...stats.daily_data.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-6">
      <h2 className="text-lg font-semibold text-white">Auth Overview</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/[.07] bg-white/[.02] p-4"
          >
            <p className="text-xs text-zinc-400 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {stats.daily_data.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">Daily Verifications</h3>
          <div className="flex items-end gap-1.5 h-32">
            {stats.daily_data.map((day, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] text-zinc-500">{day.count}</span>
                <div
                  className="w-full rounded-t bg-violet-600/60 hover:bg-violet-500/60 transition-colors"
                  style={{
                    height: `${(day.count / maxCount) * 100}%`,
                    minHeight: "2px",
                  }}
                  title={`${day.date}: ${day.count}`}
                />
                <span className="text-[9px] text-zinc-600 truncate w-full text-center">
                  {day.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
