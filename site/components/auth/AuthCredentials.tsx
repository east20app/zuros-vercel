"use client";

import { useState } from "react";
import { rotateAuthKey } from "@/lib/actions/auth.actions";

interface AuthCredentialsProps {
  licenseId: string;
}

export default function AuthCredentials({ licenseId }: AuthCredentialsProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  const handleRotate = async () => {
    setIsRotating(true);
    setError(null);
    setSuccess(false);
    setNewKey(null);
    try {
      const r = await rotateAuthKey(licenseId);
      if (r.ok) {
        setNewKey(r.data.integration_key);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setError(r.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao rotacionar chave.");
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Credentials</h2>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 text-sm">
          Key rotated successfully
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">Integration Key</p>
          <p className="text-xs text-zinc-500">
            Used to authenticate API requests from your bot
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] text-emerald-300">
          Active
        </span>
      </div>

      {newKey && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <p className="text-xs font-medium text-amber-300">
            Save this key — it will not be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-black/40 px-3 py-2 text-xs text-amber-200 font-mono break-all">
              {newKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newKey);
              }}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-300 hover:text-white"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleRotate}
          disabled={isRotating}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {isRotating ? "Rotating..." : "Rotate Key"}
        </button>
      </div>
    </div>
  );
}
