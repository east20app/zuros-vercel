"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  fetchAuthGifts,
  createAuthGiftAction,
  redeemAuthGiftAction,
  deleteAuthGiftAction,
} from "@/lib/actions/auth.actions";

interface AuthGiftsProps {
  licenseId: string;
}

interface Gift {
  id: string;
  name: string;
  role_id: string;
  role_name: string;
  members_count: number;
  active: boolean;
  code: string;
  created_at: string;
}

export default function AuthGifts({ licenseId }: AuthGiftsProps) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRoleId, setFormRoleId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadGifts = useCallback(async () => {
    try {
      const r = await fetchAuthGifts(licenseId);
      if (r.ok) {
        setGifts(r.data as unknown as Gift[]);
        setError(null);
      } else {
        setError(r.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar gifts.");
    }
  }, [licenseId]);

  useEffect(() => {
    startTransition(() => {
      loadGifts();
    });
  }, [loadGifts]);

  const handleCreate = async () => {
    if (!formName.trim() || !formRoleId.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await createAuthGiftAction(licenseId, { name: formName, role_id: formRoleId, members_count: 0 });
      setFormName("");
      setFormRoleId("");
      setShowForm(false);
      await loadGifts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao criar gift.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRedeem = async (giftId: string) => {
    setRedeemingId(giftId);
    try {
      await redeemAuthGiftAction(licenseId, giftId);
      await loadGifts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao resgatar gift.");
    } finally {
      setRedeemingId(null);
    }
  };

  const handleDelete = async (giftId: string) => {
    setDeletingId(giftId);
    try {
      await deleteAuthGiftAction(licenseId, giftId);
      await loadGifts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao deletar gift.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Auth Gifts</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {showForm ? "Cancel" : "Create Gift"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4 space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">New Gift</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Gift name"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
            <input
              type="text"
              value={formRoleId}
              onChange={(e) => setFormRoleId(e.target.value)}
              placeholder="Role ID"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
            <button
              onClick={handleCreate}
              disabled={isCreating || !formName.trim() || !formRoleId.trim()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {isPending && gifts.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : gifts.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No gifts created yet</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gifts.map((gift) => (
            <div
              key={gift.id}
              className="rounded-xl border border-white/[.07] bg-white/[.02] p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">{gift.name}</h4>
                  <p className="text-xs text-zinc-500 font-mono">{gift.code}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                    gift.active
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-zinc-500/15 border-zinc-500/30 text-zinc-400"
                  }`}
                >
                  {gift.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="space-y-1 text-xs text-zinc-400">
                <p>Role: <span className="text-zinc-300">{gift.role_name || gift.role_id}</span></p>
                <p>Members: <span className="text-zinc-300">{gift.members_count}</span></p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRedeem(gift.id)}
                  disabled={redeemingId === gift.id || !gift.active}
                  className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-300 hover:text-white disabled:opacity-40"
                >
                  {redeemingId === gift.id ? "Redeeming..." : "Redeem"}
                </button>
                <button
                  onClick={() => handleDelete(gift.id)}
                  disabled={deletingId === gift.id}
                  className="rounded-xl bg-red-600/20 border border-red-500/30 px-3 py-2 text-xs text-red-300 hover:bg-red-600/30 disabled:opacity-40"
                >
                  {deletingId === gift.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
