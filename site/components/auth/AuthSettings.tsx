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
        setSuccess("Configurações gerais salvas.");
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
        setSuccess("Regras de proteção salvas.");
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
    { key: "zuros_oauth2" as const, label: "Ativar OAuth2 do ZUROS", desc: "Usa o fluxo de verificação OAuth2 do ZUROS." },
    { key: "require_oauth2" as const, label: "Exigir OAuth2", desc: "Pede verificação OAuth2 antes de liberar o acesso." },
    { key: "persistent_oauth2" as const, label: "OAuth2 persistente", desc: "Mantém a sessão OAuth2 entre acessos." },
    { key: "auto_join_oauth2" as const, label: "Entrada automática", desc: "Adiciona o membro ao servidor após a verificação." },
  ];

  const cargoDefs = [
    { key: "remove_autorole" as const, label: "Remover autorole", desc: "Remove o cargo quando o membro perde a verificação." },
  ];

  const protecaoDefs = [
    { key: "block_vpn" as const, label: "Bloquear VPN", desc: "Bloqueia acessos identificados por VPN." },
    { key: "block_mobile" as const, label: "Bloquear mobile", desc: "Bloqueia acessos feitos por dispositivos móveis." },
    { key: "block_no_verified_email" as const, label: "Exigir e-mail verificado", desc: "Bloqueia membros sem e-mail confirmado." },
    { key: "block_no_email" as const, label: "Exigir e-mail", desc: "Bloqueia membros sem e-mail associado." },
    { key: "block_spam" as const, label: "Bloquear spam", desc: "Bloqueia contas identificadas como spam." },
  ];

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-6">
      <div className="auth-module-intro"><div><p className="auth-module-kicker">REGRAS DE OPERAÇÃO</p><h3>Como o acesso deve funcionar.</h3></div></div>

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
        <h3 className="auth-subsection-title">Identidade e destinos</h3>

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400">Auth Name</label>
          <input
            type="text"
            value={settings.auth_name}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, auth_name: e.target.value }))
            }
            placeholder="My Auth"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400">Guild</label>
          <select
            value={settings.guild_id}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, guild_id: e.target.value }))
            }
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
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
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
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
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
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
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#091116] hover:bg-[var(--accent-strong)] disabled:opacity-40"
          >
            {isSavingSettings ? "Salvando..." : "Salvar identidade"}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="auth-subsection-title">Políticas de proteção</h3>

        <div className="space-y-3">
          <h4 className="auth-subsection-kicker">Fluxo OAuth</h4>
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
                  definitions[def.key] ? "bg-[var(--accent)]" : "bg-zinc-700"
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
          <h4 className="auth-subsection-kicker">Cargos</h4>
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
                  definitions[def.key] ? "bg-[var(--accent)]" : "bg-zinc-700"
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
          <h4 className="auth-subsection-kicker">Proteções</h4>
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
                  definitions[def.key] ? "bg-[var(--accent)]" : "bg-zinc-700"
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
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#091116] hover:bg-[var(--accent-strong)] disabled:opacity-40"
          >
            {isSavingDefs ? "Salvando..." : "Salvar políticas"}
          </button>
        </div>
      </div>
    </div>
  );
}
