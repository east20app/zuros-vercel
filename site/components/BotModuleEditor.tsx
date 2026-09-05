"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BotConfigModule } from "@/lib/bot-config";
import { BOT_MODULE_META } from "@/lib/bot-config-meta";
import { useBotConfig, type BotConfigError } from "@/hooks/useBotConfig";
import { getBotGuildResources, type DiscordGuildChannel, type DiscordGuildRole } from "@/lib/actions/bot-config.actions";
import { useToast } from "./Toast";
import { LojaEditor } from "./config/LojaEditor";
import { ProtectionEditor } from "./config/ProtectionEditor";
import { AutomationsEditor } from "./config/AutomationsEditor";
import { CloudEditor } from "./config/CloudEditor";
import { DroxDiscordPreview } from "./DroxDiscordPreview";
import { ProtectionDashboard } from "./ProtectionDashboard";
import { ModulePanelPublisher } from "./ModulePanelPublisher";
import { Button, Card, Empty, Field, Spinner, inputClass } from "./ui";
import { Icon } from "./Icon";

const labels: Record<string, string> = { enabled: "Ativado", ativo: "Ativado", automatico: "Automático", autoApproval: "Aprovação automática", intervalo: "Intervalo (minutos)", interval: "Intervalo", status: "Status/atividade", bio: "Biografia", cor: "Cor principal", color: "Cor principal", mensagem: "Mensagem", message: "Mensagem" };
const labelFor = (key: string) => labels[key] || key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
function updateAt(source: Record<string, unknown>, path: string[], value: unknown) { const clone = structuredClone(source); let cursor: Record<string, unknown> = clone; path.slice(0, -1).forEach((key) => { cursor = cursor[key] as Record<string, unknown>; }); cursor[path[path.length - 1]] = value; return clone; }

function MultiCheckboxField({ items, value, onChange }: { items: Array<{ id: string; name: string }>; value: string[]; onChange: (value: string[]) => void }) {
    const selected = new Set(value);
    return <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/[.08] bg-[#1e1f22] p-2">{items.map((item) => { const checked = selected.has(item.id); return <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition ${checked ? "bg-[#00CBA4]/20 text-white" : "text-[#b5bac1] hover:bg-[#35373c]"}`}><input type="checkbox" checked={checked} onChange={() => onChange(checked ? value.filter((id) => id !== item.id) : [...value, item.id])} className="h-4 w-4 accent-[#00CBA4]" /><span className="truncate">{item.name}</span></label>; })}</div>;
}

const COMMON_EMOJIS = ["🛒", "🎫", "🎉", "✅", "❌", "⚙️", "🔒", "🔔", "💳", "💰", "📦", "👤", "⭐", "🚀", "🛡️", "📢"];

function EmojiField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
    return <Field label={label} hint="Escolha um emoji ou cole um emoji personalizado do Discord"><div className="space-y-2"><div className="flex gap-2"><span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg border border-white/[.08] bg-[#1e1f22] text-xl">{value || "🙂"}</span><input id={id} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Emoji ou <:nome:id>" /></div><div className="flex flex-wrap gap-1.5">{COMMON_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => onChange(emoji)} className={`grid h-8 w-8 place-items-center rounded-md border text-base transition ${value === emoji ? "border-[#00CBA4] bg-[#00CBA4]/20" : "border-white/[.07] bg-[#232428] hover:bg-[#35373c]"}`} aria-label={`Usar ${emoji}`}>{emoji}</button>)}</div></div></Field>;
}

function PrimitiveListField({ id, label, values, onChange }: { id: string; label: string; values: unknown[]; onChange: (values: string[]) => void }) {
    const [next, setNext] = useState("");
    const items = values.map(String);
    const add = () => { const normalized = next.trim(); if (!normalized || items.includes(normalized)) return; onChange([...items, normalized]); setNext(""); };
    return <Field label={label} hint="Adicione, revise ou remova itens"><div className="space-y-2"><div className="flex flex-col gap-2 sm:flex-row"><input id={id} className={inputClass} value={next} onChange={(event) => setNext(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="Digite um item" /><Button type="button" variant="secondary" onClick={add}>Adicionar</Button></div><div className="flex min-h-10 flex-wrap gap-2 rounded-lg border border-white/[.07] bg-[#1e1f22] p-2">{items.length ? items.map((item, index) => <span key={`${item}-${index}`} className="inline-flex items-center gap-2 rounded-md bg-[#35373c] px-2.5 py-1.5 text-xs text-[#dbdee1]">{item}<button type="button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="text-[#f87175] hover:text-red-300" aria-label={`Remover ${item}`}>×</button></span>) : <span className="px-1 py-1 text-xs text-[#949ba4]">Nenhum item adicionado.</span>}</div></div></Field>;
}

function newArrayItem(path: string[], channels: DiscordGuildChannel[]): Record<string, unknown> | null {
    const key = path.join(".");
    if (key.endsWith("memberCounter.contadores")) return { guild_id: channels[0]?.guildId || null, canal_id: null, cargo_id: null, prefixo: "Membros" };
    if (key.endsWith("memberCounterCall.contadores")) return { guild_id: channels[0]?.guildId || null, target_id: null, tipo: "voice", prefixo: "Em call" };
    if (key.endsWith("reactions.reactions")) return { type: "channel", value: null, emoji: "✅" };
    if (key.endsWith("autoResponse.responses")) return { keyword: "", response: "", ephemeral: false };
    if (key.endsWith("topics.topicos")) return { id: crypto.randomUUID(), channel_id: null, name: "Novo tópico", content: "", locked: false };
    if (key.endsWith("config.panels.options")) return { id: crypto.randomUUID(), name: "Nova opção", description: "", emoji: null };
    if (/config\.panels\.[^.]+\.options$/.test(key)) return { id: crypto.randomUUID(), name: "Nova opção", description: "", emoji: null };
    if (/config\.panels\.[^.]+\.forms\.[^.]+$/.test(key)) return { id: crypto.randomUUID(), label: "Nova pergunta", placeholder: "", style: "short", required: false };
    return null;
}

function newRecordItem(path: string[]): Record<string, unknown> | null {
    const key = path.join(".");
    if (key.endsWith("autoMessage.mensagens")) return { channel_id: null, intervalo_minutos: 60, editor_data: { content: "" }, ultima_enviada: null, last_message_id: null };
    if (key.endsWith("config.panels")) return {
        name: "Novo painel", mode: "channel", message_style: "embed", has_pending_changes: true,
        button: { label: "Abrir Ticket", emoji: "📩", style: "green" },
        embed: { title: "SEJA BEM-VINDO(A) AO SUPORTE 👋", description: "Clique no botão abaixo para abrir um ticket e ser atendido por nossa equipe.", color: "#00CBA4" },
        content: { content: "# SEJA BEM-VINDO(A) AO SUPORTE 👋\n\nClique no botão abaixo para abrir um ticket." },
        container: { content: "# SEJA BEM-VINDO(A) AO SUPORTE 👋\n\nClique no botão abaixo para abrir um ticket.", color: "#00CBA4" }, messages: {},
    };
    return null;
}
function selectOptions(path: string[], key: string): Array<{ value: string; label: string }> | null {
    const joined = [...path, key].join(".");
    if (key === "message_style") return [{ value: "embed", label: "Embed" }, { value: "content", label: "Mensagem" }, { value: "container", label: "Componentes V2" }];
    if (key === "modo_envio") return [{ value: "v2", label: "Componentes V2" }, { value: "embed", label: "Embed" }];
    if (key === "rota_envio") return [{ value: "canal", label: "Canal" }, { value: "dm", label: "Mensagem direta" }, { value: "ambos", label: "Canal e DM" }];
    if (key === "style" && joined.includes("button")) return [{ value: "green", label: "Verde" }, { value: "blurple", label: "Azul" }, { value: "grey", label: "Cinza" }, { value: "red", label: "Vermelho" }];
    if (key === "style" && joined.includes("forms")) return [{ value: "short", label: "Curta" }, { value: "paragraph", label: "Parágrafo" }];
    if (key === "mode" && joined.includes("tickets")) return [{ value: "channel", label: "Canal" }, { value: "thread", label: "Tópico" }];
    if (key === "type" && joined.includes("reactions")) return [{ value: "channel", label: "Por canal" }, { value: "word", label: "Por palavra" }];
    return null;
}
function DynamicFields({ value, onChange, roles = [], channels = [], path = [] }: { value: Record<string, unknown>; onChange: (path: string[], value: unknown) => void; roles?: DiscordGuildRole[]; channels?: DiscordGuildChannel[]; path?: string[] }) {
    return <div className="grid gap-4 md:grid-cols-2">{Object.entries(value).map(([key, current]) => {
        const fieldPath = [...path, key]; const id = fieldPath.join("-");
        if (typeof current === "boolean") return <label key={id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[.08] bg-[#232428] p-4 transition hover:border-[#00CBA4]/50"><span><span className="block text-sm font-medium text-[#f2f3f5]">{labelFor(key)}</span><span className="mt-0.5 block text-xs text-[#949ba4]">Clique para ativar ou desativar</span></span><span className={`relative h-6 w-11 rounded-full transition ${current ? "bg-[#23a559]" : "bg-[#4e5058]"}`}><input aria-label={labelFor(key)} type="checkbox" checked={current} onChange={(e) => onChange(fieldPath, e.target.checked)} className="sr-only" /><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${current ? "left-6" : "left-1"}`} /></span></label>;
        if (typeof current === "number") return <Field key={id} label={labelFor(key)}><input id={id} className={inputClass} type="number" value={current} onChange={(e) => onChange(fieldPath, Number(e.target.value))} /></Field>;
        const roleField = /cargo|role/i.test(key) && !Array.isArray(current);
        const channelField = /canal|channel/i.test(key) && !Array.isArray(current);
        if (roleField && roles.length) return <Field key={id} label={labelFor(key)} hint="Cargos detectados no servidor principal"><select id={id} className={inputClass} value={typeof current === "string" ? current : ""} onChange={(e) => onChange(fieldPath, e.target.value || null)}><option value="">Nenhum cargo</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}{role.managed ? " (integração)" : ""}</option>)}</select></Field>;
        if (channelField && channels.length) return <Field key={id} label={labelFor(key)} hint="Canais detectados no servidor principal"><select id={id} className={inputClass} value={typeof current === "string" ? current : ""} onChange={(e) => onChange(fieldPath, e.target.value || null)}><option value="">Nenhum canal</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.type === 4 ? "Categoria" : channel.type === 2 || channel.type === 13 ? "Voz" : "#"} {channel.name}</option>)}</select></Field>;
        if (typeof current === "string" && selectOptions(path, key)) return <Field key={id} label={labelFor(key)}><select id={id} className={inputClass} value={current} onChange={(e) => onChange(fieldPath, e.target.value)}>{selectOptions(path, key)!.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;
        if (typeof current === "string") { const color = /cor|color/i.test(key) && /^#[0-9a-f]{6}$/i.test(current); const secret = /token|secret|password|senha|key|chave/i.test(key); const emoji = /emoji|emote/i.test(key); const multiline = /mensagem|message|description|descricao|descrição|conteudo|conteúdo|texto|embed|prompt|bio/i.test(key); if (emoji) return <EmojiField key={id} id={id} label={labelFor(key)} value={current} onChange={(value) => onChange(fieldPath, value)} />; return <Field key={id} label={labelFor(key)}><div className="flex gap-2">{color && <input aria-label={`Selecionar ${labelFor(key)}`} type="color" value={current} onChange={(e) => onChange(fieldPath, e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-[#4e5058] bg-[#1e1f22] p-1" />}{multiline && !secret ? <textarea id={id} rows={4} className={inputClass} value={current} onChange={(e) => onChange(fieldPath, e.target.value)} /> : <input id={id} type={secret ? "password" : "text"} className={inputClass} value={current} onChange={(e) => onChange(fieldPath, e.target.value)} />}</div></Field>; }
        if (current === null) return <Field key={id} label={labelFor(key)} hint={roleField ? "Nenhum cargo detectado; confira o servidor principal" : "Informe o ID utilizado no Discord"}><input id={id} className={inputClass} value="" placeholder="Nenhum selecionado" onChange={(e) => onChange(fieldPath, e.target.value || null)} /></Field>;
        if (Array.isArray(current) && /cargo|role/i.test(key) && roles.length) return <Field key={id} label={labelFor(key)} hint="Clique para marcar os cargos"><MultiCheckboxField items={roles} value={current.map(String)} onChange={(next) => onChange(fieldPath, next)} /></Field>;
        if (Array.isArray(current) && /canal|channel|categoria/i.test(key) && channels.length) return <Field key={id} label={labelFor(key)} hint="Clique para marcar os canais"><MultiCheckboxField items={channels.map((channel) => ({ id: channel.id, name: `${channel.type === 4 ? "Categoria" : channel.type === 2 || channel.type === 13 ? "Voz" : "#"} ${channel.name}` }))} value={current.map(String)} onChange={(next) => onChange(fieldPath, next)} /></Field>;
        if (Array.isArray(current) && current.every((item) => item === null || ["string", "number"].includes(typeof item))) return <PrimitiveListField key={id} id={id} label={labelFor(key)} values={current} onChange={(values) => onChange(fieldPath, values)} />;
        if (Array.isArray(current)) { const template = newArrayItem(fieldPath, channels); return <fieldset key={id} className="rounded-lg border border-white/[.08] bg-[#232428] p-4 md:col-span-2"><legend className="px-2 text-sm font-semibold text-[#f2f3f5]">{labelFor(key)}</legend><div className="space-y-3">{current.map((item, index) => <div key={index} className="rounded-lg border border-white/[.06] bg-[#1e1f22] p-3">{item && typeof item === "object" && !Array.isArray(item) ? <DynamicFields value={item as Record<string, unknown>} roles={roles} channels={channels} path={[...fieldPath, String(index)]} onChange={onChange} /> : <span className="text-sm text-[#b5bac1]">{String(item)}</span>}<button type="button" onClick={() => onChange(fieldPath, current.filter((_, itemIndex) => itemIndex !== index))} className="mt-3 rounded-md bg-[#f23f43]/10 px-2.5 py-1.5 text-xs text-[#f87175] hover:bg-[#f23f43]/20">Remover</button></div>)}<div className="flex flex-wrap items-center gap-2">{template ? <Button type="button" variant="secondary" onClick={() => onChange(fieldPath, [...current, structuredClone(template)])}>Adicionar</Button> : null}{current.length ? <Button type="button" variant="secondary" onClick={() => onChange(fieldPath, [...current, structuredClone(current[current.length - 1])])}>Duplicar último</Button> : !template ? <p className="text-sm text-[#949ba4]">Esta lista é gerenciada pelas ações do bot no Discord.</p> : null}</div></div></fieldset>; }
        if (current && typeof current === "object") { const record = current as Record<string, unknown>; const template = newRecordItem(fieldPath); return <fieldset key={id} className="rounded-lg border border-white/[.08] bg-[#232428] p-4 md:col-span-2"><legend className="flex items-center gap-2 px-2 text-sm font-semibold text-[#f2f3f5]"><i className="h-2 w-2 rounded-full bg-[#00CBA4]" />{labelFor(key)}</legend>{Object.keys(record).length ? <DynamicFields value={record} roles={roles} channels={channels} path={fieldPath} onChange={onChange} /> : <p className="mb-3 text-sm text-[#949ba4]">Nenhuma configuração criada pelo bot.</p>}{template ? <Button type="button" variant="secondary" onClick={() => onChange(fieldPath, { ...record, [crypto.randomUUID()]: structuredClone(template) })}>Adicionar</Button> : null}</fieldset>; }
        return null;
    })}</div>;
}

const SETTINGS_LABELS: Record<string, string> = {
    cargos: "Cargos", canais: "Canais", pagamentos: "Pagamentos", antifake: "Anti-Fake",
    notificacoes: "Notificações", blacklist: "Bloquear usuários",
};
const PAYMENT_LABELS: Record<string, string> = {
    pix_manual: "Pix Manual", mercado_pago: "Mercado Pago", efibank: "Efi Bank", pushinpay: "Pushin Pay",
    misticpay: "MisticPay", sync_wallet: "Sync Wallet", livepix: "Live Pix", pagbank: "PagBank", picpay: "PicPay",
    stripe: "Stripe", nowpayments: "NowPayments", coinbase: "Coinbase", asaas: "Asaas", paypal: "PayPal",
    nubank: "Nubank", inter: "Inter", bitcoin: "Bitcoin", litecoin: "Litecoin", ethereum: "Ethereum",
};
const PAYMENT_CATEGORIES = {
    pix: ["sync_wallet", "pix_manual", "mercado_pago", "efibank", "pagbank", "picpay", "pushinpay", "misticpay", "asaas"],
} as const;
const PAYMENT_CATEGORY_LABELS = { pix: "Pix" } as const;
const PAYMENT_COMING_SOON = new Set<string>();
const MODULE_SECTION_LABELS: Partial<Record<BotConfigModule, Record<string, string>>> = {
    automacoes: {
        config: "Visão geral", aiChat: "zurosAI Chat", aiModerator: "zurosAI Moderator", welcome: "Boas-vindas",
        clean: "Limpeza de canais", memberCounter: "Contador por cargo", memberCounterCall: "Contador em call",
        salesCounter: "Contador de vendas", feedbacks: "Monitor de feedbacks", inviteTracker: "Invite Tracker",
        lockUnlock: "Lock/Unlock", autoMessage: "Mensagens automáticas", nuke: "Nuke automático",
        reactions: "Reações automáticas", repost: "Repostagem de produtos", autoResponse: "Respostas automáticas",
        suggestions: "Sistema de sugestões", topics: "Tópicos automáticos",
    },
    customizacao: { colors: "Paleta de cores", status: "Status do bot", info: "Informações", mode: "Componentes V1/V2" },
    tickets: { config: "Painéis e preferências" },
    giveaways: { config: "Sorteios e tarefas" },
    cloud: { config: "Credenciais e verificação", tasks: "Tarefas OAuth2", gifts: "Presentes" },
    mensagens: { announce: "Anúncios", templates: "Modelos de mensagens", directMessage: "Editor de mensagem direta" },
    extensions: {
        config: "Ativação de extensões", droxgen: "DROX Gen", boostData: "Zuros Boost · dados",
        boostStock: "Zuros Boost · estoque", subscriptions: "Assinaturas pagas",
        pendingPayments: "Pagamentos pendentes", paymentHistory: "Histórico de pagamentos",
    },
};

function GenericModuleEditor({ modulo, value, roles, channels, onChange }: { modulo: BotConfigModule; value: Record<string, unknown>; roles: DiscordGuildRole[]; channels: DiscordGuildChannel[]; onChange: (path: string[], value: unknown) => void }) {
    const entries = Object.entries(value);
    const [selected, setSelected] = useState(entries[0]?.[0] || "");
    const current = value[selected];
    const labelsForModule = MODULE_SECTION_LABELS[modulo] || {};
    return <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"><aside className="rounded-lg border border-white/[.08] bg-[#2b2d31] p-2"><p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[#949ba4]">Opções do módulo</p><select aria-label="Opção do módulo" className={`${inputClass} lg:hidden`} value={selected} onChange={(event) => setSelected(event.target.value)}>{entries.map(([alias]) => <option key={alias} value={alias}>{labelsForModule[alias] || labelFor(alias)}</option>)}</select><nav className="hidden space-y-1 lg:block">{entries.map(([alias]) => <button type="button" key={alias} onClick={() => setSelected(alias)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition ${selected === alias ? "border border-[#00CBA4]/35 bg-[#00CBA4]/10 font-medium text-white" : "text-[#b5bac1] hover:bg-[#35373c] hover:text-white"}`}><span className={`h-2 w-2 rounded-full ${selected === alias ? "bg-[#00CBA4]" : "bg-[#6d6f78]"}`} />{labelsForModule[alias] || labelFor(alias)}</button>)}</nav></aside><Card className="min-w-0"><div className="mb-5 flex items-center gap-3 border-b border-white/[.07] pb-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#00CBA4]/15 text-[#00CBA4]"><Icon name={BOT_MODULE_META[modulo].icon} /></span><div><h2 className="text-sm font-semibold text-[#f2f3f5]">{labelsForModule[selected] || labelFor(selected)}</h2><p className="text-xs text-[#949ba4]">Configuração sincronizada com o módulo do DROX.</p></div></div>{current && typeof current === "object" && !Array.isArray(current) ? Object.keys(current).length ? <DynamicFields value={current as Record<string, unknown>} roles={roles} channels={channels} path={[selected]} onChange={onChange} /> : <div className="rounded-lg border border-dashed border-white/[.1] p-8 text-center"><p className="text-sm text-[#b5bac1]">Nenhum item configurado.</p><p className="mt-1 text-xs text-[#949ba4]">Quando o DROX criar esta configuração, ela aparecerá aqui.</p></div> : <p className="text-sm text-[#949ba4]">Esta opção ainda não possui dados configuráveis.</p>}</Card></div>;
}

function PaymentProviderEditor({ value, status, onChange }: { value: Record<string, unknown>; status: Record<string, unknown>; onChange: (path: string[], value: unknown) => void }) {
    const [category, setCategory] = useState<keyof typeof PAYMENT_CATEGORIES>("pix");
    const available = PAYMENT_CATEGORIES[category].filter((key) => !PAYMENT_COMING_SOON.has(key));
    const [provider, setProvider] = useState<string>(available[0] || "");
    useEffect(() => { if (!available.includes(provider as never)) setProvider(available[0] || ""); }, [category, provider, available]);
    const providerConfig = value[provider];
    const selected = providerConfig && typeof providerConfig === "object" && !Array.isArray(providerConfig) ? providerConfig as Record<string, unknown> : null;
    const providerChange = (path: string[], next: unknown) => { onChange(path, next); if (path.at(-1) === "enabled") onChange(["pagamentosStatus", provider], next); };
    return <div className="space-y-5"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#949ba4]">Categoria</p><div className="grid grid-cols-3 gap-2">{(Object.keys(PAYMENT_CATEGORIES) as Array<keyof typeof PAYMENT_CATEGORIES>).map((key) => <button type="button" key={key} onClick={() => setCategory(key)} className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${category === key ? "border-[#00CBA4] bg-[#00CBA4] text-white" : "border-white/[.08] bg-[#232428] text-[#b5bac1] hover:bg-[#35373c]"}`}>{PAYMENT_CATEGORY_LABELS[key]}</button>)}</div></div><div className="rounded-lg border border-white/[.08] bg-[#232428] p-4"><div className="mb-3 flex items-center gap-3"><Icon name="payment" className="text-[#949cf7]" /><div><h3 className="text-sm font-semibold text-white">Formas de pagamento — {PAYMENT_CATEGORY_LABELS[category]}</h3><p className="text-xs text-[#949ba4]">Escolha a mesma forma disponível no módulo do DROX.</p></div></div>{available.length ? <select className={inputClass} value={provider} onChange={(event) => setProvider(event.target.value)}>{available.map((key) => { const entry = value[key] as Record<string, unknown> | undefined; const enabled = Boolean(entry?.enabled ?? status[key]); const configured = Boolean(entry && Object.entries(entry).some(([field, fieldValue]) => field !== "enabled" && Boolean(fieldValue))); return <option key={key} value={key}>{PAYMENT_LABELS[key]} — {enabled ? "Ativado" : configured ? "Desativado" : "Não configurado"}</option>; })}</select> : <p className="text-sm text-[#949ba4]">Nenhum provedor disponível nesta categoria no momento.</p>}</div>{selected && <div className="rounded-lg border border-[#00CBA4]/30 bg-[#232428] p-4"><div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#00CBA4]/15 text-[#949cf7]"><Icon name="payment" /></span><div><h3 className="text-sm font-semibold text-[#f2f3f5]">{PAYMENT_LABELS[provider]}</h3><p className="text-xs text-[#949ba4]">Ative e configure as credenciais exigidas pelo DROX.</p></div></div>{provider === "pix_manual" && <Field label="Tipo da chave Pix"><select className={inputClass} value={String(selected.pix_key_type || "")} onChange={(event) => onChange(["pagamentos", provider, "pix_key_type"], event.target.value)}><option value="">Selecione</option><option value="email">Email</option><option value="telefone">Telefone</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="aleatoria">Aleatória</option></select></Field>}<div className={provider === "pix_manual" ? "mt-4" : ""}><DynamicFields value={provider === "pix_manual" ? Object.fromEntries(Object.entries(selected).filter(([key]) => key !== "pix_key_type")) : selected} path={["pagamentos", provider]} onChange={providerChange} /></div>{provider === "efibank" && <p className="mt-4 rounded-lg border border-[#f0b232]/30 bg-[#f0b232]/10 p-3 text-xs text-[#f8c25c]">O certificado .p12 precisa existir no ambiente do bot em execução para a Efi ser ativada, igual ao módulo do Discord.</p>}</div>}</div>;
}

function ConfiguracoesEditor({ value, roles, channels, onChange }: { value: Record<string, unknown>; roles: DiscordGuildRole[]; channels: DiscordGuildChannel[]; onChange: (path: string[], value: unknown) => void }) {
    const sections = Object.keys(SETTINGS_LABELS).filter((key) => key in value && key !== "pagamentos");
    const [selected, setSelected] = useState(sections[0] || "cargos");
    const document = value[selected];
    return <Card><div className="mb-5 border-b border-white/[.07] pb-5"><Field label="Opção do painel" hint="Escolha uma área para configurar"><select className={inputClass} value={selected} onChange={(event) => setSelected(event.target.value)}>{sections.filter((key) => key !== "pagamentosStatus").map((key) => <option key={key} value={key}>{SETTINGS_LABELS[key]}</option>)}</select></Field></div>{selected === "pagamentos" && document && typeof document === "object" && !Array.isArray(document) ? <PaymentProviderEditor value={document as Record<string, unknown>} status={(value.pagamentosStatus as Record<string, unknown>) || {}} onChange={onChange} /> : document && typeof document === "object" && !Array.isArray(document) ? <DynamicFields value={document as Record<string, unknown>} roles={roles} channels={channels} path={[selected]} onChange={onChange} /> : <p className="text-sm text-[#949ba4]">Esta opção ainda não possui configuração.</p>}</Card>;
}

function SaveBar({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
    return (
        <div className="sticky top-16 z-20 -mx-5 mb-6 flex items-center justify-between gap-3 border-b border-zinc-900/80 bg-black/85 px-5 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:border-white/[.05] sm:bg-zinc-950/80 sm:px-4">
            <span className={`flex items-center gap-2 text-xs ${dirty ? "text-amber-400" : "text-zinc-600"}`}>
                <i className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                {dirty ? "Alterações não salvas" : "Tudo salvo"}
            </span>
            <Button disabled={!dirty || saving} onClick={onSave}>{saving ? <Spinner /> : null}Salvar</Button>
        </div>
    );
}

export function DroxPaymentsEditor({ storeId }: { storeId: string }) {
    const api = useBotConfig(storeId, "configuracoes");
    const { push } = useToast();
    const router = useRouter();
    const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
    useEffect(() => { if (api.data) setDraft(structuredClone(api.data)); }, [api.data]);
    const dirty = useMemo(() => Boolean(draft && api.data && JSON.stringify(draft) !== JSON.stringify(api.data)), [draft, api.data]);
    const save = async () => {
        if (!draft) return;
        try {
            const result = await api.save(draft);
            push(result.synced ? "Pagamentos salvos e aplicados ao bot" : result.warning || "Pagamentos salvos; reinicie o bot para aplicar", result.synced ? "success" : "error");
            router.refresh();
        } catch (error) {
            push((error as BotConfigError).message || "Não foi possível salvar os pagamentos", "error");
        }
    };
    if (api.loading) return <div className="space-y-4"><div className="skeleton h-16 rounded-xl" /><div className="skeleton h-72 rounded-xl" /></div>;
    if (api.error || !draft) return <Empty icon="!" title="Não foi possível abrir os pagamentos" text={api.error?.message || "Confira se o bot está online."} action={<Button onClick={() => void api.reload()}>Tentar novamente</Button>} />;
    const payments = draft.pagamentos;
    if (!payments || typeof payments !== "object" || Array.isArray(payments)) return <Empty title="Pagamentos ainda não configurados" text="Abra o módulo de loja no bot para criar a configuração inicial." />;
    return <div><SaveBar dirty={dirty} saving={api.saving} onSave={() => void save()} /><PaymentProviderEditor value={payments as Record<string, unknown>} status={(draft.pagamentosStatus as Record<string, unknown>) || {}} onChange={(path, value) => setDraft(updateAt(draft, path, value))} /></div>;
}

export function BotModuleEditor({ storeId, modulo, productsOnly = false }: { storeId: string; modulo: BotConfigModule; productsOnly?: boolean }) {
    const api = useBotConfig(storeId, modulo); const { push } = useToast(); const router = useRouter(); const [draft, setDraft] = useState<Record<string, unknown> | null>(null); const [roles, setRoles] = useState<DiscordGuildRole[]>([]); const [channels, setChannels] = useState<DiscordGuildChannel[]>([]);
    useEffect(() => { if (api.data) setDraft(structuredClone(api.data)); }, [api.data]);
    useEffect(() => { let active = true; void getBotGuildResources(storeId).then(({ roles: roleItems, channels: channelItems }) => { if (active) { setRoles(roleItems); setChannels(channelItems); } }).catch(() => { if (active) { setRoles([]); setChannels([]); } }); return () => { active = false; }; }, [storeId]);
    const dirty = useMemo(() => Boolean(draft && api.data && JSON.stringify(draft) !== JSON.stringify(api.data)), [draft, api.data]);
    useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
    useEffect(() => { const guard = (event: MouseEvent) => { if (!dirty) return; const anchor = (event.target as HTMLElement).closest("a"); if (!anchor || anchor.target === "_blank" || !anchor.href.startsWith(location.origin)) return; if (!window.confirm("Você tem alterações não salvas. Deseja sair mesmo assim?")) event.preventDefault(); }; document.addEventListener("click", guard, true); return () => document.removeEventListener("click", guard, true); }, [dirty]);
    const save = async () => { if (!draft) return; try { const result = await api.save(draft); push(result.synced ? "Configurações salvas e aplicadas ao bot" : result.warning || "Configurações salvas; reinicie o bot para aplicar", result.synced ? "success" : "error"); router.refresh(); } catch (error) { push((error as BotConfigError).message || "Não foi possível salvar — bot está offline", "error"); } };
    const meta = BOT_MODULE_META[modulo];
    if (api.loading) return <div aria-label="Carregando configuração"><div className="flex items-center gap-3"><div className="skeleton h-11 w-11 rounded-2xl" /><div className="space-y-2"><div className="skeleton h-4 w-44 rounded-lg" /><div className="skeleton h-3 w-64 rounded-lg" /></div></div><div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-24 rounded-2xl border border-white/[.04]" />)}</div><div className="skeleton hidden h-[420px] rounded-2xl border border-white/[.04] xl:block" /></div></div>;
    if (api.error || !draft) return <div><Empty icon="!" title={api.error?.status === 403 ? "Acesso negado" : "Não foi possível conectar ao bot"} text={api.error?.message || "O bot está offline. As alterações ficam bloqueadas até ele responder."} action={<Button onClick={() => void api.reload()}>Tentar novamente</Button>} /></div>;
    if (modulo === "protecao") return <div><SaveBar dirty={dirty} saving={api.saving} onSave={() => void save()} /><div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="flex flex-col gap-6"><ProtectionDashboard data={draft} /><ProtectionEditor value={draft} roles={roles} channels={channels} onChange={setDraft} /></div><DroxDiscordPreview value={draft} title="Proteção geral" /></div></div>;
    return <div><SaveBar dirty={dirty} saving={api.saving} onSave={() => void save()} /><div className={`grid items-start gap-6 ${productsOnly ? "" : "xl:grid-cols-[minmax(0,1fr)_380px]"}`}><div className="min-w-0">{(modulo === "tickets" || modulo === "cloud") ? <ModulePanelPublisher appId={storeId} moduleName={modulo} value={draft} channels={channels} /> : null}{modulo === "loja" ? <LojaEditor appId={storeId} value={draft} roles={roles} channels={channels} onChange={setDraft} productsOnly={productsOnly} persist={async (next) => { try { await api.save(next); push("Alteração salva com sucesso"); } catch (error) { push((error as BotConfigError).message || "Não foi possível salvar", "error"); await api.reload(); } }} /> : modulo === "configuracoes" ? <ConfiguracoesEditor value={draft} roles={roles} channels={channels} onChange={(path, value) => setDraft(updateAt(draft, path, value))} /> : modulo === "automacoes" ? <AutomationsEditor value={draft} roles={roles} channels={channels} onChange={setDraft} /> : modulo === "cloud" ? <CloudEditor value={draft} channels={channels} onChange={(path, value) => setDraft(updateAt(draft, path, value))} /> : <GenericModuleEditor modulo={modulo} value={draft} roles={roles} channels={channels} onChange={(path, value) => setDraft(updateAt(draft, path, value))} />}</div>{productsOnly ? null : <DroxDiscordPreview value={draft} title={`Prévia · ${meta.name}`} />}</div></div>;
}
