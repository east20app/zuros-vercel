"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useTransition } from "react";
import { fetchAuthDestinations } from "@/lib/actions/auth.actions";

interface AuthServersProps {
  licenseId: string;
}

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  online: boolean;
}

export default function AuthServers({ licenseId }: AuthServersProps) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadServers = useCallback(() => {
    startTransition(async () => {
      try {
        const r = await fetchAuthDestinations(licenseId);
        if (r.ok) {
          setGuilds(r.data.items as unknown as Guild[]);
          setError(null);
        } else {
          setError(r.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Falha ao carregar servidores.");
      }
    });
  }, [licenseId]);

  useEffect(() => { loadServers(); }, [loadServers]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 sm:p-6 space-y-3">
        <p className="text-red-300 text-sm">{error}</p>
        <button onClick={loadServers} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300 hover:bg-red-500/20">Tentar novamente</button>
      </div>
    );
  }

  if (isPending || guilds.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 rounded bg-white/5" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Auth Servers</h2>

      <div className="space-y-2">
        {guilds.map((guild) => (
          <div
            key={guild.id}
            className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-4"
          >
            {guild.icon ? (
              <Image unoptimized width={40} height={40}
                src={guild.icon}
                alt={guild.name}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-300">
                {guild.name.charAt(0)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {guild.name}
              </p>
              <p className="text-xs text-zinc-500">{guild.id}</p>
            </div>

            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                guild.online
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                  : "bg-zinc-500/15 border-zinc-500/30 text-zinc-400"
              }`}
            >
              {guild.online ? "Online" : "Offline"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
