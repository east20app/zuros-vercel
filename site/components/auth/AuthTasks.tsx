"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { fetchAuthTasks } from "@/lib/actions/auth.actions";

interface AuthTasksProps {
  licenseId: string;
}

interface Task {
  id: string;
  type: string;
  status: string;
  progress: number;
  total: number;
  processed: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export default function AuthTasks({ licenseId }: AuthTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadTasks = useCallback(async () => {
    try {
      const r = await fetchAuthTasks(licenseId);
      if (r.ok) {
        setTasks(r.data.items as unknown as Task[]);
        setError(null);
      } else {
        setError(r.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar tarefas.");
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return "bg-amber-500/15 border-amber-500/30 text-amber-300";
      case "completed":
        return "bg-emerald-500/15 border-emerald-500/30 text-emerald-300";
      case "failed":
        return "bg-red-500/15 border-red-500/30 text-red-300";
      case "queued":
        return "bg-violet-500/15 border-violet-500/30 text-violet-300";
      default:
        return "bg-zinc-500/15 border-zinc-500/30 text-zinc-400";
    }
  };

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-5">
      <h2 className="text-lg font-semibold text-white">Tasks</h2>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {isPending && tasks.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No tasks running</p>
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
                    <span className="text-sm font-medium text-white capitalize">
                      {task.type.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] ${getStatusBadge(task.status)}`}
                    >
                      {task.status}
                    </span>
                  </div>

                  <span className="text-xs text-zinc-500">
                    {task.processed} / {task.total}
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      task.status === "failed"
                        ? "bg-red-500"
                        : task.status === "completed"
                        ? "bg-emerald-500"
                        : "bg-violet-600"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {task.error && (
                  <p className="text-xs text-red-400">{task.error}</p>
                )}

                <div className="flex gap-4 text-[10px] text-zinc-600">
                  {task.started_at && (
                    <span>Started: {new Date(task.started_at).toLocaleString()}</span>
                  )}
                  {task.completed_at && (
                    <span>Completed: {new Date(task.completed_at).toLocaleString()}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
