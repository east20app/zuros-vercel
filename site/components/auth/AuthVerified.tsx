"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { fetchAuthVerifiedUsers } from "@/lib/actions/auth.actions";

interface AuthVerifiedProps {
  licenseId: string;
}

interface VerifiedUser {
  user_id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  verified_at: string;
  status: string;
  roles: string[];
}

export default function AuthVerified({ licenseId }: AuthVerifiedProps) {
  const [users, setUsers] = useState<VerifiedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    startTransition(async () => {
      try {
        const r = await fetchAuthVerifiedUsers(licenseId);
        if (r.ok) {
          setUsers(r.data.items as unknown as VerifiedUser[]);
          setError(null);
        } else {
          setError(r.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Falha ao carregar usuários verificados.");
      }
    });
  }, [licenseId]);

  const filtered = users.filter((user) => {
    const matchesSearch =
      search === "" ||
      user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.user_id.includes(search);
    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedUsers = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 sm:p-6 text-red-300 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Verified Users</h2>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by username or ID..."
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
        >
          <option value="all">All Status</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : paginatedUsers.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No verified users found</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[.07]">
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">User</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">ID</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Verified At</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Status</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Roles</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b border-white/[.04] hover:bg-white/[.02]"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {user.avatar ? (
                          <Image unoptimized width={28} height={28}
                            src={user.avatar}
                            alt={user.username}
                            className="h-7 w-7 rounded-full"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] text-[var(--accent)]">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-white font-medium">{user.username}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-zinc-500 font-mono text-xs">
                      {user.user_id}
                    </td>
                    <td className="py-3 px-3 text-zinc-400 text-xs">
                      {new Date(user.verified_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                          user.status === "verified"
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                            : user.status === "pending"
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                            : "bg-red-500/15 border-red-500/30 text-red-300"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-400 text-xs">
                      {user.roles.length > 0 ? user.roles.join(", ") : "—"}
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
