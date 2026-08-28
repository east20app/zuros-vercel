"use client";

import { useEffect, useState, useTransition } from "react";
import {
  fetchAuthDestinations,
  saveAuthSettings,
  saveAuthDefinitions,
} from "@/lib/actions/auth.actions";

interface AuthSettingsProps {
  licenseId: string;
}

interface Guild {
  id: string;
  name: string;
}

interface Settings {
  auth_name: string;
  guild_id: string;
  verified_role_id: string;
  autorole_id: string;
  log_channel_id: string;
}

interface Definitions {
  zuros_oauth2: boolean;
  require_oauth2: boolean;
  persistent_oauth2: boolean;
  auto_join_oauth2: boolean;
  remove_autorole: boolean;
  block_vpn: boolean;
  block_mobile: boolean;
  block_no_verified_email: boolean;
  block_no_email: boolean;
  block_spam: boolean;
}

const defaultSettings: Settings = {
  auth_name: "",
  guild_id: "",
  verified_role_id: "",
  autorole_id: "",
  log_channel_id: "",
};

const defaultDefinitions: Definitions = {
  zuros_oauth2: false,
  require_oauth2: false,
  persistent_oauth2: false,
  auto_join_oauth2: false,
  remove_autorole: false,
  block_vpn: false,
  block_mobile: false,
  block_no_verified_email: false,
  block_no_email: false,
  block_spam: false,
};

export default function AuthSettings({ licenseId }: AuthSettingsProps) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [definitions, setDefinitions] = useState<Definitions>(defaultDefinitions);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingDefs, setIsSavingDefs] = useState(false);

  useEffect(() => {
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
        setError(err instanceof Error ? err.message : "Falha ao carregar configurações.");
      }
    });
  }, [licenseId]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await saveAuthSettings(licenseId, (settings as unknown as Record<string, unknown>));
      if (r.ok) {
        setSuccess("Settings saved successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar configurações.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveDefinitions = async () => {
    setIsSavingDefs(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await saveAuthDefinitions(licenseId, (definitions as unknown as Record<string, boolean>));
      if (r.ok) {
        setSuccess("Definitions saved successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(r.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar definições.");
    } finally {
      setIsSavingDefs(false);
    }
  };

  const toggleDef = (key: keyof Definitions) => {
    setDefinitions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const oauthDefs = [
    { key: "zuros_oauth2" as const, label: "ZUROS OAuth2", desc: "Enable ZUROS OAuth2 verification flow" },
    { key: "require_oauth2" as const, label: "Require OAuth2", desc: "Require OAuth2 verification before granting access" },
    { key: "persistent_oauth2" as const, label: "Persistent OAuth2", desc: "Keep OAuth2 tokens persistent across sessions" },
    { key: "auto_join_oauth2" as const, label: "Auto Join OAuth2", desc: "Automatically join guild after OAuth2 verification" },
  ];

  const cargoDefs = [
    { key: "remove_autorole" as const, label: "Remove Autorole", desc: "Remove autorole when user is unverified" },
  ];

  const protecaoDefs = [
    { key: "block_vpn" as const, label: "Block VPN", desc: "Block users connecting via VPN" },
    { key: "block_mobile" as const, label: "Block Mobile", desc: "Block users connecting from mobile devices" },
    { key: "block_no_verified_email" as const, label: "Block No Verified Email", desc: "Block users without a verified email" },
    { key: "block_no_email" as const, label: "Block No Email", desc: "Block users without any email" },
    { key: "block_spam" as const, label: "Block Spam", desc: "Block detected spam accounts" },
  ];

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-6">
      <h2 className="text-lg font-semibold text-white">Auth Settings</h2>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-zinc-300">General Settings</h3>

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400">Auth Name</label>
          <input
            type="text"
            value={settings.auth_name}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, auth_name: e.target.value }))
            }
            placeholder="My Auth"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400">Guild</label>
          <select
            value={settings.guild_id}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, guild_id: e.target.value }))
            }
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
          >
            <option value="">Select a guild</option>
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Verified Role ID</label>
            <input
              type="text"
              value={settings.verified_role_id}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, verified_role_id: e.target.value }))
              }
              placeholder="Role ID"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Autorole ID</label>
            <input
              type="text"
              value={settings.autorole_id}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, autorole_id: e.target.value }))
              }
              placeholder="Role ID"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Log Channel ID</label>
            <input
              type="text"
              value={settings.log_channel_id}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, log_channel_id: e.target.value }))
              }
              placeholder="Channel ID"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {isSavingSettings ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="text-sm font-medium text-zinc-300">Definitions</h3>

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-400">Fluxo OAuth</h4>
          {oauthDefs.map((def) => (
            <label
              key={def.key}
              className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-3 cursor-pointer hover:bg-white/[.04]"
            >
              <div>
                <p className="text-sm text-white">{def.label}</p>
                <p className="text-[11px] text-zinc-500">{def.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleDef(def.key)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  definitions[def.key] ? "bg-violet-600" : "bg-zinc-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    definitions[def.key] ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </label>
          ))}
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-400">Cargos</h4>
          {cargoDefs.map((def) => (
            <label
              key={def.key}
              className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-3 cursor-pointer hover:bg-white/[.04]"
            >
              <div>
                <p className="text-sm text-white">{def.label}</p>
                <p className="text-[11px] text-zinc-500">{def.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleDef(def.key)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  definitions[def.key] ? "bg-violet-600" : "bg-zinc-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    definitions[def.key] ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </label>
          ))}
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-400">Proteções</h4>
          {protecaoDefs.map((def) => (
            <label
              key={def.key}
              className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-3 cursor-pointer hover:bg-white/[.04]"
            >
              <div>
                <p className="text-sm text-white">{def.label}</p>
                <p className="text-[11px] text-zinc-500">{def.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleDef(def.key)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  definitions[def.key] ? "bg-violet-600" : "bg-zinc-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    definitions[def.key] ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveDefinitions}
            disabled={isSavingDefs}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {isSavingDefs ? "Saving..." : "Save Definitions"}
          </button>
        </div>
      </div>
    </div>
  );
}
