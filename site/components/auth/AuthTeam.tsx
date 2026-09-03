"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  fetchAuthTeam,
  inviteAuthTeamAction,
  updateAuthTeamMemberAction,
  removeAuthTeamMemberAction,
} from "@/lib/actions/auth.actions";

interface AuthTeamProps {
  licenseId: string;
}

interface TeamMember {
  user_id: string;
  username: string;
  avatar: string | null;
  role: string;
  joined_at: string;
}

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderator" },
  { value: "viewer", label: "Viewer" },
];

export default function AuthTeam({ licenseId }: AuthTeamProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [inviteId, setInviteId] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [isInviting, setIsInviting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    try {
      const r = await fetchAuthTeam(licenseId);
      if (r.ok) {
        setMembers(r.data as unknown as TeamMember[]);
        setError(null);
      } else {
        setError(r.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao carregar equipe.");
    }
  }, [licenseId]);

  useEffect(() => {
    startTransition(() => {
      loadMembers();
    });
  }, [loadMembers]);

  const handleInvite = async () => {
    if (!inviteId.trim()) return;
    setIsInviting(true);
    setError(null);
    try {
      await inviteAuthTeamAction(licenseId, inviteId, inviteRole);
      setInviteId("");
      setInviteRole("viewer");
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao convidar membro.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      await updateAuthTeamMemberAction(licenseId, userId, newRole);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar cargo.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      await removeAuthTeamMemberAction(licenseId, userId);
      await loadMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao remover membro.");
    } finally {
      setRemovingId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-[var(--accent-soft)] border-[var(--accent)]/30 text-[var(--accent)]";
      case "moderator":
        return "bg-amber-500/15 border-amber-500/30 text-amber-300";
      default:
        return "bg-zinc-500/15 border-zinc-500/30 text-zinc-400";
    }
  };

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-5">
      <h2 className="text-lg font-semibold text-white">Auth Team</h2>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Invite Member</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={inviteId}
            onChange={(e) => setInviteId(e.target.value)}
            placeholder="Discord User ID"
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleInvite}
            disabled={isInviting || !inviteId.trim()}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#091116] hover:bg-[var(--accent-strong)] disabled:opacity-40"
          >
            {isInviting ? "Inviting..." : "Invite"}
          </button>
        </div>
      </div>

      {isPending && members.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No team members</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[.07]">
                <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Member</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">ID</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Role</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-zinc-400">Joined</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.user_id}
                  className="border-b border-white/[.04] hover:bg-white/[.02]"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {member.avatar ? (
                        <Image unoptimized width={28} height={28}
                          src={member.avatar}
                          alt={member.username}
                          className="h-7 w-7 rounded-full"
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] text-[var(--accent)]">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-white font-medium">{member.username}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-zinc-500 font-mono text-xs">
                    {member.user_id}
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                      disabled={updatingId === member.user_id}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] bg-transparent outline-none ${getRoleBadge(member.role)} disabled:opacity-40`}
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-black text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-3 text-zinc-400 text-xs">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleRemove(member.user_id)}
                      disabled={removingId === member.user_id}
                      className="rounded-xl bg-red-600/20 border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/30 disabled:opacity-40"
                    >
                      {removingId === member.user_id ? "..." : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
