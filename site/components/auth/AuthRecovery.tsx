"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  fetchAuthRecovery,
  startAuthRecoveryTask,
  cancelAuthRecoveryTask,
} from "@/lib/actions/auth.actions";

interface AuthRecoveryProps {
  licenseId: string;
}

interface RecoveryTask {
  id: string;
  guild_id: string;
  guild_name: string;
  status: string;
  progress: number;
  total: number;
  processed: number;
  started_at: string;
}

export default function AuthRecovery({ licenseId }: AuthRecoveryProps) {
  const [tasks, setTasks] = useState<RecoveryTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [guildId, setGuildId] = useState("");
  const [limit, setLimit] = useState("100");
  const [isStarting, setIsStarting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const r = await fetchAuthRecovery(licenseId);
      if (r.ok) {
        setTasks(r.data as unknown as RecoveryTask[]);
        setError(null);
      } else {
        setError(r.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar tarefas de recuperação.");
    }
  }, [licenseId]);

  useEffect(() => {
    startTransition(() => {
      loadTasks();
    });
  }, [loadTasks]);

  useEffect(() => {
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleStart = async () => {
    if (!guildId.trim()) return;
    setIsStarting(true);
    setError(null);
    try {
      await startAuthRecoveryTask(licenseId, guildId, parseInt(limit) || 100);
      setGuildId("");
      setLimit("100");
      await loadTasks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar tarefa.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async (taskId: string) => {
    setCancellingId(taskId);
    try {
      await cancelAuthRecoveryTask(licenseId, taskId);
      await loadTasks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao cancelar tarefa.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-5">
      <h2 className="text-lg font-semibold text-white">Recovery Tasks</h2>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Start New Recovery</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            placeholder="Guild ID"
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
          />
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Limit"
            min="1"
            max="1000"
            className="w-24 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
          />
          <button
            onClick={handleStart}
            disabled={isStarting || !guildId.trim()}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {isStarting ? "Starting..." : "Start"}
          </button>
        </div>
      </div>

      {isPending && tasks.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No recovery tasks</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const progress = task.total > 0 ? (task.processed / task.total) * 100 : 0;
            return (
              <div
                key={task.id}
                className="rounded-xl border border-white/[.07] bg-white/[.02] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">
                      {task.guild_name || task.guild_id}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                        task.status === "running"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                          : task.status === "completed"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                          : task.status === "cancelled"
                          ? "bg-zinc-500/15 border-zinc-500/30 text-zinc-400"
                          : "bg-red-500/15 border-red-500/30 text-red-300"
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>

                  {task.status === "running" && (
                    <button
                      onClick={() => handleCancel(task.id)}
                      disabled={cancellingId === task.id}
                      className="rounded-xl bg-red-600/20 border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-600/30 disabled:opacity-40"
                    >
                      {cancellingId === task.id ? "Cancelling..." : "Cancel"}
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>
                      {task.processed} / {task.total} processed
                    </span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-violet-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {task.started_at && (
                  <p className="text-[10px] text-zinc-600">
                    Started: {new Date(task.started_at).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
