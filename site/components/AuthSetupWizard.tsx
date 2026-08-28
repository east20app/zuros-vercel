"use client";

import { useState, useCallback } from "react";
import { createPurchasedAuth, discoverPurchasedAuth } from "@/lib/actions/auth.actions";

type Destination = { guild_id: string; guild_name: string; guild_icon?: string | null };

export default function AuthSetupWizard({ licenseId }: { licenseId: string }) {
  const [form, setForm] = useState({ name: "Meu Auth", clientId: "", clientSecret: "", botToken: "", guildId: "" });
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [botName, setBotName] = useState("");
  const [result, setResult] = useState<{ callbackUrl: string; integrationKey: string | null } | null>(null);
  const [error, setError] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const field = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  const inputClass = "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-violet-500";

  const discover = useCallback(async () => {
    setError("");
    setIsDiscovering(true);
    try {
      const r = await discoverPurchasedAuth(licenseId, { clientId: form.clientId.trim(), botToken: form.botToken.trim() });
      if (!r.ok) { setError(r.error); return; }
      setDestinations(r.data.destinations);
      setBotName(r.data.bot.bot_name);
      if (r.data.destinations.length === 1) setForm((value) => ({ ...value, guildId: r.data.destinations[0].guild_id }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao validar bot. Verifique os dados e tente novamente.");
    } finally {
      setIsDiscovering(false);
    }
  }, [licenseId, form.clientId, form.botToken]);

  const create = useCallback(async () => {
    setError("");
    setIsCreating(true);
    try {
      const r = await createPurchasedAuth(licenseId, form);
      if (!r.ok) { setError(r.error); return; }
      setResult({ callbackUrl: r.data.callbackUrl, integrationKey: r.data.integrationKey });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao criar auth. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  }, [licenseId, form]);

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-[#08090b] p-5 sm:p-7">
        <p className="text-xl font-semibold text-white">Auth configurado com sucesso</p>
        <p className="mt-2 text-sm text-zinc-400">Copie a chave agora. Por segurança, ela só é exibida uma vez.</p>
        <div className="mt-5 space-y-4">
          <Secret label="Key de integração" value={result.integrationKey || "A chave já havia sido criada anteriormente."} />
          <Secret label="Callback URL" value={result.callbackUrl} />
        </div>
        <a href={`/dashboard/auth/${licenseId}`} className="mt-6 block rounded-xl bg-violet-600 px-5 py-3 text-center font-semibold text-white hover:bg-violet-500">
          Abrir painel do Auth
        </a>
      </div>
    );
  }

  const canDiscover = form.clientId.trim().length >= 10 && form.botToken.trim().length >= 20;
  const canCreate = !!form.guildId;

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-[#08090b] p-5 sm:p-7">
      <div className="mb-6">
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">Configuração protegida</span>
        <h2 className="mt-4 text-2xl font-semibold text-white">Conecte seu bot OAuth</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Use os dados da aplicação no Discord Developer Portal. Os segredos são enviados diretamente ao backend do ZUROS Auth e armazenados criptografados.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-zinc-300">
          Nome do Auth
          <input className={inputClass} value={form.name} onChange={(e) => field("name", e.target.value)} />
        </label>
        <label className="text-sm text-zinc-300">
          Client ID
          <input className={inputClass} value={form.clientId} onChange={(e) => field("clientId", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="18-20 dígitos" />
        </label>
        <label className="text-sm text-zinc-300">
          Client Secret
          <input className={inputClass} type="password" value={form.clientSecret} onChange={(e) => field("clientSecret", e.target.value)} autoComplete="off" />
        </label>
        <label className="text-sm text-zinc-300">
          Bot Token
          <input className={inputClass} type="password" value={form.botToken} onChange={(e) => field("botToken", e.target.value)} autoComplete="off" placeholder="Mínimo 20 caracteres" />
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!destinations.length ? (
        <button
          disabled={isDiscovering || !canDiscover}
          onClick={discover}
          className="mt-6 w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isDiscovering ? "Validando no Discord..." : "Validar bot e buscar servidores"}
        </button>
      ) : (
        <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="font-medium text-white">{botName} validado</p>
          <label className="mt-4 block text-sm text-zinc-300">
            Servidor principal
            <select className={inputClass} value={form.guildId} onChange={(e) => field("guildId", e.target.value)}>
              <option value="">Selecione o servidor</option>
              {destinations.map((g) => (
                <option key={g.guild_id} value={g.guild_id}>{g.guild_name}</option>
              ))}
            </select>
          </label>
          <button
            disabled={isCreating || !canCreate}
            onClick={create}
            className="mt-4 w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCreating ? "Criando auth..." : "Criar e configurar auth"}
          </button>
        </div>
      )}
    </div>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-2 flex gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-3 text-sm text-zinc-200">{value}</code>
        <button
          onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
          className="shrink-0 rounded-xl border border-white/10 px-4 text-sm text-white hover:bg-white/5"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
