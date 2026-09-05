"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Empty, Field, Modal, inputClass } from "../ui";
import type { DiscordGuildChannel, DiscordGuildRole } from "@/lib/actions/bot-config.actions";
import { PanelPublisher } from "@/components/PanelPublisher";
import { ProductPublisher } from "@/components/ProductPublisher";

type Doc = Record<string, unknown>;
type Aggregate = Record<string, unknown>;

function generateId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    }
    return Math.random().toString(36).slice(2, 12);
}
function nowTs(): number {
    return Math.floor(Date.now() / 1000);
}
function setPath<T extends Record<string, unknown>>(source: T, path: (string | number)[], value: unknown): T {
    const clone: Record<string, unknown> = structuredClone(source);
    let cursor: Record<string, unknown> = clone;
    for (const key of path.slice(0, -1)) {
        const next = (cursor[key] as Record<string, unknown> | undefined) ?? {};
        if (typeof next !== "object") continue;
        cursor[key] = next;
        cursor = next;
    }
    cursor[String(path[path.length - 1])] = value;
    return clone as T;
}
function getPath(source: Record<string, unknown>, path: (string | number)[]): unknown {
    let cursor: unknown = source;
    for (const key of path) {
        if (cursor && typeof cursor === "object" && key in (cursor as Record<string, unknown>)) {
            cursor = (cursor as Record<string, unknown>)[String(key)];
        } else {
            return undefined;
        }
    }
    return cursor;
}
function asRecord(raw: unknown): Doc {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Doc) : {};
}
function str(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}
function bool(value: unknown): boolean {
    return Boolean(value);
}
function stockCount(stock: unknown): number {
    if (Array.isArray(stock)) return stock.length;
    if (stock && typeof stock === "object") return Object.keys(stock).length;
    return 0;
}
function formatBRL(value: unknown): string {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}
function tsToDateLocal(ts: unknown): string {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return "";
    return new Date(n * 1000).toISOString().slice(0, 16);
}
function dateLocalToTs(value: string): number | null {
    if (!value) return null;
    const n = Date.parse(value);
    return Number.isFinite(n) ? Math.floor(n / 1000) : null;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-semibold text-white">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
                </div>
            </div>
            {children}
        </Card>
    );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/30 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.02)] transition hover:border-emerald-500/30">
            <span className="min-w-0">
                <span className="block text-sm text-zinc-200">{label}</span>
                {hint && <small className="mt-0.5 block text-xs text-zinc-500">{hint}</small>}
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_14px_-2px_rgba(16,185,129,.7)]" : "bg-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,.5)]"}`}>
                <i className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
            </span>
        </button>
    );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <Field label={label}>
            <div className="flex flex-col gap-2 sm:flex-row">
                <input aria-label={`Selecionar ${label}`} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-900 p-1" />
                <input className={inputClass} value={value || ""} placeholder="#RRGGBB" onChange={(e) => onChange(e.target.value)} />
            </div>
        </Field>
    );
}

function StringList({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder?: string }) {
    const text = Array.isArray(value) ? value.join("\n") : "";
    return (
        <textarea
            className={`${inputClass} font-mono text-xs`}
            rows={4}
            placeholder={placeholder || "Um item por linha"}
            value={text}
            onChange={(e) => onChange(e.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}
        />
    );
}

function JsonEditor({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
    const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
    const [invalid, setInvalid] = useState(false);
    useEffect(() => {
        setText(JSON.stringify(value ?? {}, null, 2));
        setInvalid(false);
    }, [value]);
    return (
        <div>
            <textarea
                className={`${inputClass} ${invalid ? "border-red-500/70 focus:border-red-500" : ""} font-mono text-xs`}
                rows={5}
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    try {
                        onChange(JSON.parse(e.target.value));
                        setInvalid(false);
                    } catch {
                        setInvalid(true);
                    }
                }}
            />
            {invalid && <span className="mt-1 block text-xs text-red-400">JSON inválido — só será aplicado quando estiver correto.</span>}
        </div>
    );
}

export function LojaEditor({ appId, value, onChange, persist, roles = [], channels = [], showProducts = false, productsOnly = false }: { appId: string; value: Aggregate; onChange: (next: Aggregate) => void; persist: (next: Aggregate) => Promise<void>; roles?: DiscordGuildRole[]; channels?: DiscordGuildChannel[]; showProducts?: boolean; productsOnly?: boolean }) {
    const doc = (alias: string): Doc => asRecord(value[alias]);
    const mutate = (next: Aggregate, persistNow = true) => {
        onChange(next);
        if (persistNow) void persist(next);
    };
    const setDoc = (alias: string, nextDoc: Doc, persistNow = false) => mutate({ ...value, [alias]: nextDoc }, persistNow);

    const products = Object.entries(doc("products")).map(([id, item]) => ({ id, raw: asRecord(item) }));
    let camposCount = 0;
    let totalStock = 0;
    for (const { raw } of products) {
        const campos = asRecord(getPath(raw, ["campos"]));
        camposCount += Object.keys(campos).length;
        for (const campo of Object.values(campos)) totalStock += stockCount(asRecord(campo).stock);
    }
    const stats = { products: products.length, campos: camposCount, stock: totalStock };

    const [editingProduct, setEditingProduct] = useState<{ id: string; raw: Doc } | null>(null);
    const [editingCampo, setEditingCampo] = useState<{ productId: string; campoId: string | null; campo: Doc } | null>(null);
    const [editingCoupon, setEditingCoupon] = useState<{ code: string | null; coupon: Doc } | null>(null);

    const replaceProduct = (id: string, raw: Doc) => {
        const productsDoc = { ...doc("products") };
        productsDoc[id] = raw;
        setDoc("products", productsDoc, true);
    };
    const removeProduct = (id: string) => {
        const productsDoc = { ...doc("products") };
        delete productsDoc[id];
        setDoc("products", productsDoc, true);
    };
    const commitProduct = () => {
        if (!editingProduct || !editingProduct.id) return;
        replaceProduct(editingProduct.id, { ...editingProduct.raw, id: editingProduct.id });
        setEditingProduct(null);
    };
    const commitCampo = () => {
        if (!editingCampo) return;
        const { productId, campoId, campo } = editingCampo;
        const productsDoc = { ...doc("products") };
        const product = asRecord(productsDoc[productId]);
        const campos = { ...asRecord(getPath(product, ["campos"])) };
        const finalId = campoId ?? str(campo.id, generateId());
        campos[finalId] = { ...campo, id: finalId };
        const nextProduct = { ...product, campos, info: { ...asRecord(getPath(product, ["info"])), updated_at: nowTs() } };
        replaceProduct(productId, nextProduct);
        // Mantém o modal do produto sincronizado; caso contrário, ao aplicar o
        // produto depois de criar um campo, o snapshot antigo sobrescrevia o campo.
        if (editingProduct?.id === productId) setEditingProduct({ ...editingProduct, raw: nextProduct });
        setEditingCampo(null);
    };
    const removeCampo = (productId: string, campoId: string) => {
        const productsDoc = { ...doc("products") };
        const product = asRecord(productsDoc[productId]);
        const campos = { ...asRecord(getPath(product, ["campos"])) };
        delete campos[campoId];
        const nextProduct = { ...product, campos, info: { ...asRecord(getPath(product, ["info"])), updated_at: nowTs() } };
        replaceProduct(productId, nextProduct);
        if (editingProduct?.id === productId) setEditingProduct({ ...editingProduct, raw: nextProduct });
    };

    const couponsRaw = asRecord(doc("massCoupons").coupons);
    const cashbackRules = Array.isArray(doc("cashback").rules) ? (doc("cashback").rules as Doc[]) : [];
    const commitCoupon = () => {
        if (!editingCoupon || !editingCoupon.code) return;
        const coupons = { ...couponsRaw };
        coupons[editingCoupon.code.toUpperCase()] = editingCoupon.coupon;
        setDoc("massCoupons", { ...doc("massCoupons"), coupons }, true);
        setEditingCoupon(null);
    };
    const removeCoupon = (code: string) => {
        const coupons = { ...couponsRaw };
        delete coupons[code];
        setDoc("massCoupons", { ...doc("massCoupons"), coupons }, true);
    };

    const togglePersist = (alias: string, key: string) => (checked: boolean) => {
        setDoc(alias, { ...doc(alias), [key]: checked }, true);
    };

    if (productsOnly) return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
                <Card className="!p-4"><span className="text-[11px] uppercase tracking-wider text-zinc-500">Produtos</span><div className="mt-1 text-2xl font-semibold text-white">{stats.products}</div></Card>
                <Card className="!p-4"><span className="text-[11px] uppercase tracking-wider text-zinc-500">Opções</span><div className="mt-1 text-2xl font-semibold text-white">{stats.campos}</div></Card>
                <Card className="!p-4"><span className="text-[11px] uppercase tracking-wider text-zinc-500">Estoque</span><div className="mt-1 text-2xl font-semibold text-white">{stats.stock}</div></Card>
            </div>
            <Section title="Produtos" subtitle="Preços, estoque, cargos, condições, mensagens e preferências iguais ao painel Discord.">
                <div className="mb-4 flex items-center justify-between"><span className="text-sm text-zinc-400">{products.length} produto(s)</span><Button size="sm" onClick={() => { const id = generateId(); setEditingProduct({ id, raw: { id, name: "", info: { description: null, banner: null, hex_color: null, delivery_type: "automatic", created_at: nowTs(), updated_at: nowTs(), purchasesIds: [], total_paid: 0, display_preferences: { show_sales: true, show_options: true, show_stock: true, cart_duration_minutes: 30, store_hours: "", transcript_enabled: false }, buy_button: { label: "Comprar", emoji: "🛒" } }, campos: {}, categorias: {}, messages: [], cupons: {} } }); }}>Novo produto</Button></div>
                {products.length === 0 ? <Empty text="Nenhum produto cadastrado." /> : <div className="grid gap-3 sm:grid-cols-2">{products.map(({ id, raw }) => { const campos = asRecord(raw.campos); const stock = Object.values(campos).reduce<number>((sum, campo) => sum + stockCount(asRecord(campo).stock), 0); return <div key={id} className="space-y-3 rounded-xl border border-zinc-800 bg-black/25 p-4 transition hover:border-[var(--accent)]/25"><button type="button" onClick={() => setEditingProduct({ id, raw: structuredClone(raw) })} className="flex w-full items-center justify-between gap-3 text-left"><span className="min-w-0"><b className="block truncate text-sm text-white">{str(raw.name, "Produto sem nome")}</b><small className="mt-1 block text-zinc-500">{Object.keys(campos).length} opção(ões) · {stock} item(ns)</small></span><span className="text-xs font-medium text-[var(--accent)]">Editar</span></button><ProductPublisher appId={appId} productId={id} channels={channels} /></div>; })}</div>}
            </Section>
            <Modal open={Boolean(editingProduct)} onClose={() => setEditingProduct(null)} title={editingProduct ? `Produto: ${str(editingProduct.raw.name, "novo")}` : "Novo produto"}>{editingProduct ? <ProductModalBody productId={editingProduct.id} raw={editingProduct.raw} onChange={(next) => setEditingProduct({ ...editingProduct, raw: next })} onOpenCampo={(campoId, campo) => setEditingCampo({ productId: editingProduct.id, campoId, campo })} onRemoveCampo={removeCampo} onCommit={commitProduct} onCancel={() => setEditingProduct(null)} /> : null}</Modal>
            <Modal open={Boolean(editingCampo)} onClose={() => setEditingCampo(null)} title={editingCampo ? `Opção: ${str(editingCampo.campo.name, "nova")}` : "Opção"}>{editingCampo ? <CampoModalBody campo={editingCampo.campo} roles={roles} categories={asRecord(editingProduct?.raw.categorias)} onChange={(campo) => setEditingCampo({ ...editingCampo, campo })} onCommit={commitCampo} onCancel={() => setEditingCampo(null)} /> : null}</Modal>
        </div>
    );

    return (
        <div className="space-y-6">
            {showProducts ? <div className="grid grid-cols-3 gap-3">
                <Card className="!p-4"><span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Produtos</span><div className="mt-1 text-2xl font-semibold text-white">{stats.products}</div></Card>
                <Card className="!p-4"><span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Campos</span><div className="mt-1 text-2xl font-semibold text-white">{stats.campos}</div></Card>
                <Card className="!p-4"><span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Estoque total</span><div className="mt-1 text-2xl font-semibold text-white">{stats.stock}</div></Card>
            </div> : null}

            <Section title="Vitrine" subtitle="Ativa ou desativa a loja no servidor">
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Loja ativada" hint="Abre/fecha a vitrine para os membros" checked={bool(doc("config").enabled)} onChange={togglePersist("config", "enabled")} />
                </div>
            </Section>

            {showProducts ? <Section title="Produtos" subtitle="A vitrine é formada por produtos; cada produto tem campos (opções de compra) com preço e estoque">
                <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-zinc-400">{products.length} produto(s)</span>
                    <Button size="sm" onClick={() => {
                        const id = generateId();
                        setEditingProduct({
                            id,
                            raw: {
                                id,
                                name: "",
                                info: {
                                    description: null,
                                    banner: null,
                                    hex_color: null,
                                    delivery_type: "automatic",
                                    created_at: nowTs(),
                                    updated_at: nowTs(),
                                    purchasesIds: [],
                                    total_paid: 0,
                                    display_preferences: { show_sales: true, show_options: true, show_stock: true, cart_duration_minutes: 30, store_hours: "", transcript_enabled: false },
                                    buy_button: { label: "Comprar", emoji: "🛒" },
                                },
                                campos: {},
                                categorias: {},
                                messages: [],
                                cupons: {},
                            },
                        });
                    }}>Novo produto</Button>
                </div>
                {products.length === 0 ? (
                    <Empty text="Nenhum produto cadastrado." />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="py-3 pl-4">Produto</th>
                                    <th className="py-3">Campos</th>
                                    <th className="py-3">Preço a partir de</th>
                                    <th className="py-3">Estoque</th>
                                    <th className="py-3 pr-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(({ id, raw }) => {
                                    const campos = asRecord(getPath(raw, ["campos"]));
                                    const prices = Object.values(campos).map((c) => Number(asRecord(c).price ?? 0)).filter((n) => Number.isFinite(n));
                                    const minPrice = prices.length ? Math.min(...prices) : null;
                                    const stock = Object.values(campos).reduce<number>((sum, c) => sum + stockCount(asRecord(c).stock), 0);
                                    const hex = str(getPath(raw, ["info", "hex_color"]));
                                    return (
                                        <tr key={id} className="border-b border-zinc-900 transition last:border-0 hover:bg-zinc-900/40">
                                            <td className="py-3 pl-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-6 w-6 shrink-0 rounded-lg border border-zinc-800" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#18181b" }} />
                                                    <span className="font-medium text-white">{str(raw.name, "Produto sem nome")}</span>
                                                    {getPath(raw, ["info", "delivery_type"]) === "manual" && <Badge tone="amber">Manual</Badge>}
                                                </div>
                                            </td>
                                            <td className="py-3 text-zinc-400">{Object.keys(campos).length}</td>
                                            <td className="py-3 text-zinc-400">{minPrice === null ? "—" : formatBRL(minPrice)}</td>
                                            <td className="py-3 text-zinc-400">{stock}</td>
                                            <td className="space-x-2 py-3 pr-4 text-right">
                                                <button onClick={() => setEditingProduct({ id, raw: structuredClone(raw) })} className="rounded-md px-2 py-1 text-emerald-400 transition hover:bg-emerald-500/10">Editar</button>
                                                <button onClick={() => removeProduct(id)} className="rounded-md px-2 py-1 text-red-400 transition hover:bg-red-500/10">Excluir</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Section> : null}

            <Section title="Cupons em massa" subtitle="Válidos para toda a vitrine, por código">
                <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-zinc-400">{Object.keys(couponsRaw).length} cupom(ns)</span>
                    <Button size="sm" onClick={() => setEditingCoupon({ code: null, coupon: { discount_type: "porcentagem", discount_value: 0, max_discount: null, expiration: null, max_uses: 0, uses: 0, used_by: [], min_purchase: 0, max_purchase: null, required_role: null } })}>Novo cupom</Button>
                </div>
                {Object.keys(couponsRaw).length === 0 ? (
                    <Empty text="Nenhum cupom em massa cadastrado." />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="py-3 pl-4">Código</th>
                                    <th className="py-3">Desconto</th>
                                    <th className="py-3">Usos</th>
                                    <th className="py-3">Expirado</th>
                                    <th className="py-3 pr-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(couponsRaw).map(([code, rawCoupon]) => {
                                    const coupon = asRecord(rawCoupon);
                                    const expired = Number(coupon.expiration ?? 0) > 0 && nowTs() > Number(coupon.expiration);
                                    return (
                                        <tr key={code} className="border-b border-zinc-900 transition last:border-0 hover:bg-zinc-900/40">
                                            <td className="py-3 pl-4 font-mono font-medium text-white">{code}</td>
                                            <td className="py-3 text-zinc-400">{coupon.discount_type === "porcentagem" ? `${str(coupon.discount_value, "0")}%` : formatBRL(coupon.discount_value)}</td>
                                            <td className="py-3 text-zinc-400">{Number(coupon.uses ?? 0)}{Number(coupon.max_uses) ? `/${coupon.max_uses}` : ""}</td>
                                            <td className="py-3">{expired ? <Badge tone="red">Expirado</Badge> : <span className="text-zinc-500">—</span>}</td>
                                            <td className="space-x-2 py-3 pr-4 text-right">
                                                <button onClick={() => setEditingCoupon({ code, coupon: structuredClone(coupon) })} className="rounded-md px-2 py-1 text-emerald-400 transition hover:bg-emerald-500/10">Editar</button>
                                                <button onClick={() => removeCoupon(code)} className="rounded-md px-2 py-1 text-red-400 transition hover:bg-red-500/10">Excluir</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Section>

            <Section title="Preferências da vitrine" subtitle="Carrinho, expediente, solicitação de estoque e termos">
                <PreferencesForm value={doc("preferences")} roles={roles} channels={channels} setValue={(next) => setDoc("preferences", next)} />
                <PanelPublisher appId={appId} panel="stock_requests" channels={channels} initialChannelId={str(getPath(doc("preferences"), ["stock_requests", "panel_channel_id"]), str(getPath(doc("preferences"), ["stock_requests", "channel_id"]))) } label="Enviar painel de estoque" />
            </Section>

            <Section title="Botão de dúvida" subtitle="Botão de suporte exibido nos produtos">
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Botão de dúvida ativado" checked={bool(doc("doubtButton").enabled)} onChange={togglePersist("doubtButton", "enabled")} />
                    <Field label="Texto do botão"><input className={inputClass} value={str(doc("doubtButton").button_label)} onChange={(e) => setDoc("doubtButton", { ...doc("doubtButton"), button_label: e.target.value })} /></Field>
                    <Field label="Emoji do botão"><input className={inputClass} value={str(doc("doubtButton").button_emoji)} onChange={(e) => setDoc("doubtButton", { ...doc("doubtButton"), button_emoji: e.target.value })} /></Field>
                    <Field label="Canal" hint="Canal onde o usuário é encaminhado"><ChannelSelect channels={channels} value={str(doc("doubtButton").channel_id)} onChange={(channelId) => setDoc("doubtButton", { ...doc("doubtButton"), channel_id: channelId || null })} /></Field>
                    <Field label="Mensagem"><textarea className={inputClass} rows={3} value={str(doc("doubtButton").message)} onChange={(e) => setDoc("doubtButton", { ...doc("doubtButton"), message: e.target.value })} /></Field>
                </div>
            </Section>

            <Section title="Manutenção" subtitle="Mensagem exibida quando a loja está em manutenção">
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Manutenção ativada" checked={bool(doc("maintenance").enabled)} onChange={togglePersist("maintenance", "enabled")} />
                    <ToggleRow label="Permitir administradores" checked={bool(doc("maintenance").allow_admins)} onChange={togglePersist("maintenance", "allow_admins")} />
                    <Field label="Mensagem"><textarea className={inputClass} rows={3} value={str(doc("maintenance").message)} onChange={(e) => setDoc("maintenance", { ...doc("maintenance"), message: e.target.value })} /></Field>
                </div>
            </Section>

            <Section title="QR Code" subtitle="Personalização do QR Code gerado na compra">
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="QR Code ativado" checked={bool(doc("qrCustomization").enabled)} onChange={togglePersist("qrCustomization", "enabled")} />
                    <ColorField label="Cor do QR" value={str(doc("qrCustomization").color)} onChange={(v) => setDoc("qrCustomization", { ...doc("qrCustomization"), color: v })} />
                    <ColorField label="Fundo do QR" value={str(doc("qrCustomization").background_color)} onChange={(v) => setDoc("qrCustomization", { ...doc("qrCustomization"), background_color: v })} />
                    <Field label="URL do logo"><input className={inputClass} value={str(doc("qrCustomization").logo_url)} onChange={(e) => setDoc("qrCustomization", { ...doc("qrCustomization"), logo_url: e.target.value })} /></Field>
                    <Field label="Tamanho do logo (0 a 1)"><input className={inputClass} type="number" step="0.05" min="0" max="1" value={Number(doc("qrCustomization").logo_size ?? 0.3)} onChange={(e) => setDoc("qrCustomization", { ...doc("qrCustomization"), logo_size: Number(e.target.value) })} /></Field>
                    <Field label="Estilo do canto"><select className={inputClass} value={str(doc("qrCustomization").corner_style, "square")} onChange={(e) => setDoc("qrCustomization", { ...doc("qrCustomization"), corner_style: e.target.value })}><option value="square">Quadrado</option><option value="dot">Ponto</option><option value="rounded">Arredondado</option></select></Field>
                    <Field label="Estilo do ponto"><select className={inputClass} value={str(doc("qrCustomization").dot_style, "square")} onChange={(e) => setDoc("qrCustomization", { ...doc("qrCustomization"), dot_style: e.target.value })}><option value="square">Quadrado</option><option value="dot">Ponto</option><option value="rounded">Arredondado</option></select></Field>
                </div>
            </Section>

            <Section title="Personalização" subtitle="Mensagem de compra e incentivo de avaliação">
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Mostrar usuário" checked={bool(getPath(doc("personalization"), ["purchase_event", "show_user"]))} onChange={(v) => setDoc("personalization", setPath(doc("personalization"), ["purchase_event", "show_user"], v))} />
                    <ToggleRow label="Mostrar quantidade" checked={bool(getPath(doc("personalization"), ["purchase_event", "show_quantity"]))} onChange={(v) => setDoc("personalization", setPath(doc("personalization"), ["purchase_event", "show_quantity"], v))} />
                    <ToggleRow label="Mostrar preço" checked={bool(getPath(doc("personalization"), ["purchase_event", "show_price"]))} onChange={(v) => setDoc("personalization", setPath(doc("personalization"), ["purchase_event", "show_price"], v))} />
                    <Field label="Mensagem do evento de compra"><textarea className={inputClass} rows={3} value={str(getPath(doc("personalization"), ["purchase_event", "message"]))} onChange={(e) => setDoc("personalization", setPath(doc("personalization"), ["purchase_event", "message"], e.target.value))} /></Field>
                    <Field label="Cor do evento"><input className={inputClass} value={str(getPath(doc("personalization"), ["purchase_event", "color"]))} placeholder="#RRGGBB" onChange={(e) => setDoc("personalization", setPath(doc("personalization"), ["purchase_event", "color"], e.target.value))} /></Field>
                    <Field label="Imagem do evento (URL)"><input className={inputClass} value={str(getPath(doc("personalization"), ["purchase_event", "image"]))} onChange={(e) => setDoc("personalization", setPath(doc("personalization"), ["purchase_event", "image"], e.target.value))} /></Field>
                    <Field label="Mensagem do incentivo"><textarea className={inputClass} rows={3} value={str(getPath(doc("personalization"), ["feedback_incentive", "message"]))} onChange={(e) => setDoc("personalization", setPath(doc("personalization"), ["feedback_incentive", "message"], e.target.value))} /></Field>
                    <Field label="Texto do botão de avaliação"><input className={inputClass} value={str(getPath(doc("personalization"), ["feedback_incentive", "button_text"]))} onChange={(e) => setDoc("personalization", setPath(doc("personalization"), ["feedback_incentive", "button_text"], e.target.value))} /></Field>
                </div>
            </Section>

            <Section title="Botão de compra" subtitle="Como o botão de comprar é exibido na vitrine">
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Mostrar descrição" checked={bool(doc("productPreferences").show_description)} onChange={togglePersist("productPreferences", "show_description")} />
                    <ToggleRow label="Mostrar contagem de vendas" checked={bool(doc("productPreferences").show_sales_count)} onChange={togglePersist("productPreferences", "show_sales_count")} />
                    <Field label="Texto do botão"><input className={inputClass} value={str(doc("productPreferences").button_text)} onChange={(e) => setDoc("productPreferences", { ...doc("productPreferences"), button_text: e.target.value })} /></Field>
                    <Field label="Emoji do botão"><input className={inputClass} value={str(doc("productPreferences").button_emoji)} onChange={(e) => setDoc("productPreferences", { ...doc("productPreferences"), button_emoji: e.target.value })} /></Field>
                </div>
            </Section>

            <Section title="Sistema de saldo" subtitle="Mesmas regras de saldo, bônus e painel de depósito usadas pelo DROX no Discord">
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Sistema de saldo ativado" hint="Permite usar saldo nas compras e receber depósitos" checked={bool(doc("balanceConfig").enabled)} onChange={togglePersist("balanceConfig", "enabled")} />
                    <Field label="Tipo de bônus"><select className={inputClass} value={str(getPath(doc("balanceConfig"), ["bonus", "type"]), "disabled")} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["bonus", "type"], e.target.value))}><option value="disabled">Desativado</option><option value="percentage">Percentual</option><option value="fixed">Valor fixo</option></select></Field>
                    <Field label="Valor do bônus" hint="Percentual de 0 a 100 ou valor fixo em reais"><input className={inputClass} type="number" min="0" step="0.01" value={Number(getPath(doc("balanceConfig"), ["bonus", "value"]) ?? 0)} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["bonus", "value"], Number(e.target.value)))} /></Field>
                    <Field label="Uso máximo da compra (%)"><input className={inputClass} type="number" min="0" max="100" value={Number(getPath(doc("balanceConfig"), ["rules", "max_usage_percentage"]) ?? 100)} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["rules", "max_usage_percentage"], Number(e.target.value)))} /></Field>
                    <Field label="Uso máximo em reais" hint="0 significa sem limite"><input className={inputClass} type="number" min="0" step="0.01" value={Number(getPath(doc("balanceConfig"), ["rules", "max_usage_amount"]) ?? 0)} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["rules", "max_usage_amount"], Number(e.target.value) || null))} /></Field>
                    <Field label="Uso mínimo em reais"><input className={inputClass} type="number" min="0" step="0.01" value={Number(getPath(doc("balanceConfig"), ["rules", "min_usage_amount"]) ?? 0)} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["rules", "min_usage_amount"], Number(e.target.value)))} /></Field>
                    <ToggleRow label="Permitir pagamento parcial" checked={bool(getPath(doc("balanceConfig"), ["rules", "allow_partial_payment"]))} onChange={(v) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["rules", "allow_partial_payment"], v))} />
                    <Field label="Depósito mínimo (R$)"><input className={inputClass} type="number" min="0" step="0.01" value={Number(getPath(doc("balanceConfig"), ["deposit_settings", "min_deposit"]) ?? 5)} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_settings", "min_deposit"], Number(e.target.value)))} /></Field>
                    <Field label="Depósito máximo (R$)"><input className={inputClass} type="number" min="0" step="0.01" value={Number(getPath(doc("balanceConfig"), ["deposit_settings", "max_deposit"]) ?? 1000)} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_settings", "max_deposit"], Number(e.target.value)))} /></Field>
                    <Field label="Cargo notificado"><RoleSelect roles={roles} value={str(getPath(doc("balanceConfig"), ["deposit_settings", "notify_role_id"]))} onChange={(next) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_settings", "notify_role_id"], next || null))} /></Field>
                    <Field label="Termos do depósito"><textarea className={inputClass} rows={3} value={str(getPath(doc("balanceConfig"), ["deposit_settings", "terms"]))} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_settings", "terms"], e.target.value || null))} /></Field>
                </div>
                <div className="mt-4 rounded-xl border border-[#00CBA4]/20 bg-[#00CBA4]/[.04] p-4">
                    <h3 className="mb-3 text-sm font-medium text-white">Painel de depósito</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Formato da mensagem"><select className={inputClass} value={str(getPath(doc("balanceConfig"), ["deposit_panel", "message_style"]), "embed")} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "message_style"], e.target.value))}><option value="embed">Embed</option><option value="content">Mensagem</option><option value="container">Componentes V2</option></select></Field>
                        <Field label="Canal do painel"><ChannelSelect channels={channels} value={str(getPath(doc("balanceConfig"), ["deposit_panel", "channel_id"]))} onChange={(next) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "channel_id"], next || null))} /></Field>
                        <Field label="Título"><input className={inputClass} value={str(getPath(doc("balanceConfig"), ["deposit_panel", "embed", "title"]), "Depositar Saldo")} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "embed", "title"], e.target.value))} /></Field>
                        <ColorField label="Cor" value={str(getPath(doc("balanceConfig"), ["deposit_panel", "embed", "color"]), "#00CBA4")} onChange={(next) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "embed", "color"], next))} />
                        <Field label="Descrição"><textarea className={inputClass} rows={3} value={str(getPath(doc("balanceConfig"), ["deposit_panel", "embed", "description"]))} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "embed", "description"], e.target.value))} /></Field>
                        <Field label="Imagem (URL)"><input className={inputClass} value={str(getPath(doc("balanceConfig"), ["deposit_panel", "embed", "image_url"]))} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "embed", "image_url"], e.target.value || null))} /></Field>
                        <Field label="Texto do botão"><input className={inputClass} value={str(getPath(doc("balanceConfig"), ["deposit_panel", "button", "label"]), "Depositar")} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "button", "label"], e.target.value))} /></Field>
                        <Field label="Emoji do botão"><input className={inputClass} value={str(getPath(doc("balanceConfig"), ["deposit_panel", "button", "emoji"]))} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "button", "emoji"], e.target.value || null))} /></Field>
                        <Field label="Estilo do botão"><select className={inputClass} value={str(getPath(doc("balanceConfig"), ["deposit_panel", "button", "style"]), "green")} onChange={(e) => setDoc("balanceConfig", setPath(doc("balanceConfig"), ["deposit_panel", "button", "style"], e.target.value))}><option value="green">Verde</option><option value="blurple">Azul</option><option value="grey">Cinza</option><option value="red">Vermelho</option></select></Field>
                    </div>
                    <PanelPublisher appId={appId} panel="balance" channels={channels} initialChannelId={str(getPath(doc("balanceConfig"), ["deposit_panel", "channel_id"]))} label="Enviar ou atualizar painel de saldo" />
                </div>
            </Section>
            <Section title="Cashback" subtitle="Percentual de volta por compra credenciado como saldo, mesmas regras do painel Discord">
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Cashback ativado" hint="Exige o sistema de saldo ativado; devolve um percentual da compra como saldo" checked={bool(doc("cashback").enabled)} onChange={togglePersist("cashback", "enabled")} />
                    <Field label="Percentual padrão (%)" hint="Aplicado a todos os membros; as regras por cargo multiplicam este valor"><input className={inputClass} type="number" min="0" max="100" step="0.1" value={Number(doc("cashback").default_percentage ?? 5)} onChange={(e) => setDoc("cashback", { ...doc("cashback"), default_percentage: Number(e.target.value) })} /></Field>
                    <Field label="Cashback máximo (R$)" hint="0 significa sem limite por compra"><input className={inputClass} type="number" min="0" step="0.01" value={Number(doc("cashback").max_cashback ?? 0)} onChange={(e) => setDoc("cashback", { ...doc("cashback"), max_cashback: Number(e.target.value) > 0 ? Number(e.target.value) : null })} /></Field>
                </div>
                <div className="mt-4 rounded-xl border border-[#00CBA4]/20 bg-[#00CBA4]/[.04] p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white">Regras por cargo</h3>
                        <Button size="sm" onClick={() => setDoc("cashback", { ...doc("cashback"), rules: [...cashbackRules, { role_id: "", role_name: "", multiplier: 1.0 }] })}>Adicionar regra</Button>
                    </div>
                    {cashbackRules.length === 0 ? (
                        <Empty text="Nenhuma regra por cargo. O percentual padrão será usado para todos os membros." />
                    ) : (
                        <div className="grid gap-2">
                            {cashbackRules.map((rule, index) => (
                                <div key={`${str(rule.role_id) || "novo"}-${index}`} className="grid items-end gap-2 rounded-lg border border-zinc-800 bg-black/25 p-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                                    <Field label="Cargo"><RoleSelect roles={roles} value={str(rule.role_id)} onChange={(roleId) => { const role = roles.find((r) => r.id === roleId); const next = [...cashbackRules]; next[index] = { ...rule, role_id: roleId, role_name: role?.name ?? "" }; setDoc("cashback", { ...doc("cashback"), rules: next }); }} /></Field>
                                    <Field label="Multiplicador" hint={`Final: ${Number(Number(doc("cashback").default_percentage ?? 5) * Number(rule.multiplier ?? 1)).toFixed(1)}%`}><input className={inputClass} type="number" min="0" step="0.1" value={Number(rule.multiplier ?? 1)} onChange={(e) => { const next = [...cashbackRules]; next[index] = { ...rule, multiplier: Number(e.target.value) }; setDoc("cashback", { ...doc("cashback"), rules: next }); }} /></Field>
                                    <button type="button" onClick={() => setDoc("cashback", { ...doc("cashback"), rules: cashbackRules.filter((_, i) => i !== index) })} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10">Remover</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Section>
            <Section title="Dados operacionais" subtitle="Atenção: edite com cuidado, são registros gerados pelo bot">
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Cargos temporários (loja_roles_temp)" hint="Chave = ID do usuário; lista de cargos com expiração"><JsonEditor value={doc("temporaryRoles")} onChange={(v) => setDoc("temporaryRoles", asRecord(v))} /></Field>
                    <Field label="Notificações de estoque (loja_stock_notifications)" hint="Usuários aguardando reposição de estoque"><JsonEditor value={doc("stockNotifications")} onChange={(v) => setDoc("stockNotifications", asRecord(v))} /></Field>
                    <Field label="Solicitações de estoque (loja_stock_requests)" hint="Pedidos de reposição criados pelo bot; revise ou remova entradas pendentes"><JsonEditor value={doc("stockRequests")} onChange={(v) => setDoc("stockRequests", asRecord(v))} /></Field>
                </div>
            </Section>

            <Modal open={Boolean(editingProduct)} onClose={() => setEditingProduct(null)} title={editingProduct ? `Produto: ${str(editingProduct.raw.name, "novo")}` : "Novo produto"}>
                {editingProduct && (
                    <ProductModalBody
                        productId={editingProduct.id}
                        raw={editingProduct.raw}
                        onChange={(next) => setEditingProduct({ ...editingProduct, raw: next })}
                        onOpenCampo={(campoId, campo) => setEditingCampo({ productId: editingProduct.id, campoId, campo })}
                        onRemoveCampo={removeCampo}
                        onCommit={commitProduct}
                        onCancel={() => setEditingProduct(null)}
                    />
                )}
            </Modal>

            <Modal open={Boolean(editingCampo)} onClose={() => setEditingCampo(null)} title={editingCampo ? `Campo: ${str(editingCampo.campo.name, "novo")}` : "Campo"}>
                {editingCampo && (
                    <CampoModalBody campo={editingCampo.campo} roles={roles} categories={asRecord(editingProduct?.raw.categorias)} onChange={(campo) => setEditingCampo({ ...editingCampo, campo })} onCommit={commitCampo} onCancel={() => setEditingCampo(null)} />
                )}
            </Modal>

            <Modal open={Boolean(editingCoupon)} onClose={() => setEditingCoupon(null)} title={editingCoupon ? `Cupom: ${editingCoupon.code || "novo"}` : "Cupom"}>
                {editingCoupon && (
                    <CouponModalBody coupon={editingCoupon.coupon} code={editingCoupon.code} roles={roles} onChange={(coupon) => setEditingCoupon({ ...editingCoupon, coupon })} onCodeChange={(code) => setEditingCoupon({ ...editingCoupon, code })} onCommit={commitCoupon} onCancel={() => setEditingCoupon(null)} />
                )}
            </Modal>
        </div>
    );
}

function RoleSelect({ roles, value, onChange, multiple = false }: { roles: DiscordGuildRole[]; value: string | string[]; onChange: (value: string | string[]) => void; multiple?: boolean }) {
    if (!multiple) return <select className={inputClass} value={String(value)} onChange={(event) => onChange(event.currentTarget.value)}><option value="">Nenhum cargo</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}{role.managed ? " (integração)" : ""}</option>)}</select>;
    const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
    return <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/[.08] bg-[#1e1f22] p-2">{roles.length ? roles.map((role) => { const checked = selected.has(role.id); return <label key={role.id} className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition ${checked ? "bg-[var(--accent)]/20 text-white" : "text-[#b5bac1] hover:bg-[#35373c]"}`}><input type="checkbox" checked={checked} onChange={() => { const ids = Array.from(selected); onChange(checked ? ids.filter((id) => id !== role.id) : [...ids, role.id]); }} className="h-4 w-4 accent-[var(--accent)]" /><span className="truncate">{role.name}{role.managed ? " (integração)" : ""}</span></label>; }) : <p className="px-2 py-3 text-xs text-[#949ba4]">Nenhum cargo encontrado no servidor.</p>}</div>;
}
function ChannelSelect({ channels, value, onChange }: { channels: DiscordGuildChannel[]; value: string; onChange: (value: string) => void }) {
    return <select className={inputClass} value={value} onChange={(event) => onChange(event.currentTarget.value)}><option value="">Nenhum canal</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.type === 4 ? "Categoria" : channel.type === 2 || channel.type === 13 ? "Voz" : "#"} {channel.name}</option>)}</select>;
}

function PreferencesForm({ value, setValue, roles, channels }: { value: Doc; setValue: (next: Doc) => void; roles: DiscordGuildRole[]; channels: DiscordGuildChannel[] }) {
    const set = (path: (string | number)[], next: unknown) => setValue(setPath(value, path, next));
    return (
        <div className="grid gap-3 md:grid-cols-2">
            <Field label="Duração do carrinho (minutos)"><input className={inputClass} type="number" value={Number(value.cart_duration_minutes ?? 30)} onChange={(e) => setValue({ ...value, cart_duration_minutes: Number(e.target.value) })} /></Field>
            <ToggleRow label="Transcrições ativadas" hint="Salva transcrições dos tickets de compra" checked={bool(getPath(value, ["transcript_enabled"]))} onChange={(v) => set(["transcript_enabled"], v)} />
            <Field label="Canal de transcrições"><ChannelSelect channels={channels} value={str(getPath(value, ["transcript_channel_id"]))} onChange={(next) => set(["transcript_channel_id"], next || null)} /></Field>

            <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 md:col-span-2">
                <h3 className="mb-3 text-sm font-medium text-zinc-200">Horário de funcionamento</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Expediente ativado" checked={bool(getPath(value, ["office_hours", "enabled"]))} onChange={(v) => set(["office_hours", "enabled"], v)} />
                    <Field label="Início (HH:MM)"><input className={inputClass} value={str(getPath(value, ["office_hours", "start_time"]))} placeholder="09:00" onChange={(e) => set(["office_hours", "start_time"], e.target.value)} /></Field>
                    <Field label="Fim (HH:MM)"><input className={inputClass} value={str(getPath(value, ["office_hours", "end_time"]))} placeholder="18:00" onChange={(e) => set(["office_hours", "end_time"], e.target.value)} /></Field>
                    <Field label="Dias fechados" hint="Um por linha: 0=domingo … 6=sábado"><StringList value={Array.isArray(getPath(value, ["office_hours", "off_days"])) ? (getPath(value, ["office_hours", "off_days"]) as string[]) : []} onChange={(v) => set(["office_hours", "off_days"], v)} /></Field>
                    <Field label="Mensagem fora do expediente" ><textarea className={inputClass} rows={3} value={str(getPath(value, ["office_hours", "message"]))} onChange={(e) => set(["office_hours", "message"], e.target.value)} /></Field>
                </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 md:col-span-2">
                <h3 className="mb-3 text-sm font-medium text-zinc-200">Solicitação de estoque</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Solicitação ativada" checked={bool(getPath(value, ["stock_requests", "enabled"]))} onChange={(v) => set(["stock_requests", "enabled"], v)} />
                    <Field label="Canal"><ChannelSelect channels={channels} value={str(getPath(value, ["stock_requests", "channel_id"]))} onChange={(next) => set(["stock_requests", "channel_id"], next || null)} /></Field>
                    <Field label="Cargo notificado"><RoleSelect roles={roles} value={str(getPath(value, ["stock_requests", "role_id"]))} onChange={(next) => set(["stock_requests", "role_id"], next || null)} /></Field>
                </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 md:col-span-2">
                <h3 className="mb-3 text-sm font-medium text-zinc-200">Termos de compra</h3>
                <div className="grid gap-3">
                    <ToggleRow label="Exigir aceite dos termos" checked={bool(getPath(value, ["terms", "enabled"]))} onChange={(v) => set(["terms", "enabled"], v)} />
                    <Field label="Texto dos termos"><textarea className={inputClass} rows={4} value={str(getPath(value, ["terms", "text"]))} onChange={(e) => set(["terms", "text"], e.target.value)} /></Field>
                </div>
            </div>
        </div>
    );
}

function ProductModalBody({ productId, raw, onChange, onOpenCampo, onRemoveCampo, onCommit, onCancel }: {
    productId: string;
    raw: Doc;
    onChange: (next: Doc) => void;
    onOpenCampo: (campoId: string | null, campo: Doc) => void;
    onRemoveCampo: (productId: string, campoId: string) => void;
    onCommit: () => void;
    onCancel: () => void;
}) {
    const set = (path: (string | number)[], next: unknown) => onChange(setPath(raw, path, next));
    const campos = asRecord(getPath(raw, ["campos"]));
    const categorias = asRecord(getPath(raw, ["categorias"]));
    const info = asRecord(getPath(raw, ["info"]));
    const display = asRecord(getPath(info, ["display_preferences"]));
    const buyButton = asRecord(getPath(info, ["buy_button"]));

    return (
        <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nome do produto"><input className={inputClass} value={str(raw.name)} onChange={(e) => set(["name"], e.target.value)} /></Field>
                <Field label="Cor da mensagem"><ColorField label="Cor da mensagem" value={str(getPath(info, ["hex_color"]))} onChange={(v) => set(["info", "hex_color"], v)} /></Field>
                <Field label="Tipo de entrega"><select className={inputClass} value={str(getPath(info, ["delivery_type"]), "automatic")} onChange={(e) => set(["info", "delivery_type"], e.target.value)}><option value="automatic">Automática</option><option value="manual">Manual</option></select></Field>
                <Field label="Banner (URL)"><input className={inputClass} value={str(getPath(info, ["banner"]))} onChange={(e) => set(["info", "banner"], e.target.value)} /></Field>
                <Field label="Descrição"><textarea className={inputClass} rows={3} value={str(getPath(info, ["description"]))} onChange={(e) => set(["info", "description"], e.target.value)} /></Field>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                <h3 className="mb-3 text-sm font-medium text-zinc-200">Exibição nas mensagens</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow label="Mostrar vendas" checked={bool(display.show_sales)} onChange={(v) => set(["info", "display_preferences", "show_sales"], v)} />
                    <ToggleRow label="Mostrar opções" checked={bool(display.show_options)} onChange={(v) => set(["info", "display_preferences", "show_options"], v)} />
                    <ToggleRow label="Mostrar estoque" checked={bool(display.show_stock)} onChange={(v) => set(["info", "display_preferences", "show_stock"], v)} />
                    <ToggleRow label="Transcrição de compra" checked={bool(display.transcript_enabled)} onChange={(v) => set(["info", "display_preferences", "transcript_enabled"], v)} />
                    <Field label="Duração do carrinho (min)"><input className={inputClass} type="number" value={Number(display.cart_duration_minutes ?? 30)} onChange={(e) => set(["info", "display_preferences", "cart_duration_minutes"], Number(e.target.value))} /></Field>
                    <Field label="Horário de funcionamento (texto)"><input className={inputClass} value={str(display.store_hours)} placeholder="Ex.: Seg–Sex 09:00–18:00" onChange={(e) => set(["info", "display_preferences", "store_hours"], e.target.value)} /></Field>
                    <Field label="Texto do botão comprar"><input className={inputClass} value={str(buyButton.label, "Comprar")} onChange={(e) => set(["info", "buy_button", "label"], e.target.value)} /></Field>
                    <Field label="Emoji do botão comprar"><input className={inputClass} value={str(buyButton.emoji)} onChange={(e) => set(["info", "buy_button", "emoji"], e.target.value)} /></Field>
                </div>
            </div>

            <div>
                <div className="mb-4 w-full rounded-xl border border-zinc-800 bg-black/20 p-4">
                        <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-medium text-zinc-200">Categorias ({Object.keys(categorias).length})</h3><p className="mt-1 text-xs text-zinc-500">Mesmos grupos exibidos pelo DROX.</p></div><Button size="sm" onClick={() => { const id = generateId(); set(["categorias"], { ...categorias, [id]: { id, name: "Nova categoria", emoji: null, pre_description: null, description: null } }); }}>Nova categoria</Button></div>
                        {Object.entries(categorias).length === 0 ? <Empty text="Nenhuma categoria cadastrada." /> : <div className="space-y-3">{Object.entries(categorias).map(([categoryId, rawCategory]) => { const category = asRecord(rawCategory); const updateCategory = (key: string, next: unknown) => set(["categorias"], { ...categorias, [categoryId]: { ...category, id: categoryId, [key]: next } }); return <div key={categoryId} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 md:grid-cols-2"><Field label="Nome"><input className={inputClass} value={str(category.name)} onChange={(e) => updateCategory("name", e.target.value)} /></Field><Field label="Emoji"><input className={inputClass} value={str(category.emoji)} onChange={(e) => updateCategory("emoji", e.target.value || null)} /></Field><Field label="Pré-descrição"><input className={inputClass} value={str(category.pre_description)} onChange={(e) => updateCategory("pre_description", e.target.value || null)} /></Field><Field label="Descrição"><textarea className={inputClass} rows={2} value={str(category.description)} onChange={(e) => updateCategory("description", e.target.value || null)} /></Field><button type="button" className="text-left text-xs text-red-400" onClick={() => set(["categorias"], Object.fromEntries(Object.entries(categorias).filter(([id]) => id !== categoryId)))}>Excluir categoria</button></div>; })}</div>}
                    </div>
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-200">Campos ({Object.keys(campos).length})</h3>
                    <Button size="sm" onClick={() => onOpenCampo(null, { id: generateId(), name: "", price: 0, emoji: null, pre_description: null, description: null, instructions: null, category_id: null, created_at: nowTs(), updated_at: nowTs(), advanced: {}, stock: [], cargos: { adicionar: [], remover: [], proibidos: [], duracao_minutos: null }, condicoes: { valorMin: null, valorMax: null, quantidadeMin: null, quantidadeMax: null } })}>Novo campo</Button>
                </div>
                {Object.keys(campos).length === 0 ? (
                    <Empty text="Este produto ainda não tem campos." />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/[.05]">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="py-3 pl-4">Campo</th>
                                    <th className="py-3">Preço</th>
                                    <th className="py-3">Estoque</th>
                                    <th className="py-3 pr-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(campos).map(([campoId, rawCampo]) => {
                                    const campo = asRecord(rawCampo);
                                    return (
                                        <tr key={campoId} className="border-b border-zinc-900 transition last:border-0 hover:bg-zinc-900/40">
                                            <td className="py-3 pl-4 font-medium text-white">{str(campo.name, "Sem nome")}</td>
                                            <td className="py-3 text-zinc-400">{formatBRL(campo.price)}</td>
                                            <td className="py-3 text-zinc-400">{stockCount(campo.stock)}</td>
                                            <td className="space-x-2 py-3 pr-4 text-right">
                                                <button onClick={() => onOpenCampo(campoId, structuredClone(campo))} className="rounded-md px-2 py-1 text-emerald-400 transition hover:bg-emerald-500/10">Editar</button>
                                                <button onClick={() => onRemoveCampo(productId, campoId)} className="rounded-md px-2 py-1 text-red-400 transition hover:bg-red-500/10">Excluir</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button onClick={onCommit}>Aplicar</Button>
            </div>
        </div>
    );
}

function CampoModalBody({ campo, roles, categories, onChange, onCommit, onCancel }: {
    campo: Doc;
    roles: DiscordGuildRole[];
    categories: Doc;
    onChange: (next: Doc) => void;
    onCommit: () => void;
    onCancel: () => void;
}) {
    const set = (path: (string | number)[], next: unknown) => onChange(setPath(campo, path, next));
    const cargos = asRecord(getPath(campo, ["cargos"]));
    const condicoes = asRecord(getPath(campo, ["condicoes"]));
    const stock = campo.stock ?? [];
    return (
        <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nome do campo"><input className={inputClass} value={str(campo.name)} onChange={(e) => set(["name"], e.target.value)} /></Field>
                <Field label="Preço (BRL)"><input className={inputClass} type="number" step="0.01" min="0" value={Number(campo.price ?? 0)} onChange={(e) => set(["price"], Number(e.target.value))} /></Field>
                <Field label="Emoji"><input className={inputClass} value={str(campo.emoji)} onChange={(e) => set(["emoji"], e.target.value)} /></Field>
                <Field label="Categoria"><select className={inputClass} value={str(campo.category_id)} onChange={(e) => set(["category_id"], e.target.value || null)}><option value="">Sem categoria</option>{Object.entries(categories).map(([id, rawCategory]) => <option key={id} value={id}>{str(asRecord(rawCategory).emoji)} {str(asRecord(rawCategory).name, id)}</option>)}</select></Field>
                <Field label="Pré-descrição"><textarea className={inputClass} rows={2} value={str(campo.pre_description)} onChange={(e) => set(["pre_description"], e.target.value)} /></Field>
                <Field label="Descrição"><textarea className={inputClass} rows={2} value={str(campo.description)} onChange={(e) => set(["description"], e.target.value)} /></Field>
                <Field label="Instruções pós-compra" ><textarea className={inputClass} rows={3} value={str(campo.instructions)} onChange={(e) => set(["instructions"], e.target.value)} /></Field>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                <h3 className="mb-3 text-sm font-medium text-zinc-200">Cargos</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Cargos para adicionar" hint="Clique para marcar os cargos entregues na compra"><RoleChecklist roles={roles} value={Array.isArray(cargos.adicionar) ? (cargos.adicionar as string[]) : []} onChange={(v) => set(["cargos", "adicionar"], v)} /></Field>
                    <Field label="Cargos para remover" hint="Clique para marcar os cargos removidos na compra"><RoleChecklist roles={roles} value={Array.isArray(cargos.remover) ? (cargos.remover as string[]) : []} onChange={(v) => set(["cargos", "remover"], v)} /></Field>
                    <Field label="Cargos proibidos" hint="Usuários com estes cargos não podem abrir o carrinho"><RoleChecklist roles={roles} value={Array.isArray(cargos.proibidos) ? (cargos.proibidos as string[]) : []} onChange={(v) => set(["cargos", "proibidos"], v)} /></Field>
                    <Field label="Duração do cargo (minutos)" hint="Use 0 para cargo permanente"><input className={inputClass} type="number" min="0" value={Number(cargos.duracao_minutos ?? 0)} onChange={(e) => set(["cargos", "duracao_minutos"], Math.max(0, Number(e.target.value)) || null)} /></Field>
                </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                <h3 className="mb-3 text-sm font-medium text-zinc-200">Condições de compra</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Valor mínimo (R$)"><input className={inputClass} type="number" step="0.01" value={Number(condicoes.valorMin ?? 0)} onChange={(e) => set(["condicoes", "valorMin"], e.target.value ? Number(e.target.value) : null)} /></Field>
                    <Field label="Valor máximo (R$)"><input className={inputClass} type="number" step="0.01" value={Number(condicoes.valorMax ?? 0)} onChange={(e) => set(["condicoes", "valorMax"], e.target.value ? Number(e.target.value) : null)} /></Field>
                    <Field label="Quantidade mínima"><input className={inputClass} type="number" value={Number(condicoes.quantidadeMin ?? 0)} onChange={(e) => set(["condicoes", "quantidadeMin"], e.target.value ? Number(e.target.value) : null)} /></Field>
                    <Field label="Quantidade máxima"><input className={inputClass} type="number" value={Number(condicoes.quantidadeMax ?? 0)} onChange={(e) => set(["condicoes", "quantidadeMax"], e.target.value ? Number(e.target.value) : null)} /></Field>
                </div>
            </div>

            <Field label="Estoque" hint="Coloque um item por linha. Cada venda consome um item da lista.">
                {Array.isArray(stock) ? <textarea className={`${inputClass} min-h-36 font-mono text-xs`} value={stock.map(String).join("\n")} placeholder={"email:senha\nchave-de-licença\noutro item"} onChange={(event) => set(["stock"], event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))} /> : <VisualObjectEditor value={asRecord(stock)} onChange={(next) => set(["stock"], next)} />}
            </Field>
            <Field label="Opções avançadas do campo" hint="Configure cada opção em campos separados, sem editar JSON."><VisualObjectEditor value={asRecord(campo.advanced)} onChange={(next) => set(["advanced"], next)} /></Field>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button onClick={onCommit}>Aplicar</Button>
            </div>
        </div>
    );
}

function RoleChecklist({ roles, value, onChange }: { roles: DiscordGuildRole[]; value: string[]; onChange: (value: string[]) => void }) {
    const selected = new Set(value.map(String));
    if (!roles.length) return <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-xs text-zinc-500">Nenhum cargo encontrado no servidor principal.</p>;
    return <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-zinc-800 bg-black/25 p-2">{roles.map((role) => { const checked = selected.has(role.id); return <label key={role.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${checked ? "bg-[var(--accent)]/15 text-white" : "text-zinc-400 hover:bg-zinc-900"}`}><input type="checkbox" checked={checked} onChange={() => onChange(checked ? value.filter((id) => id !== role.id) : [...value, role.id])} className="h-4 w-4 accent-[var(--accent)]" /><span className="min-w-0 flex-1 truncate">{role.name}</span>{role.managed ? <small className="text-[10px] text-zinc-600">integração</small> : null}</label>; })}</div>;
}

function VisualObjectEditor({ value, onChange }: { value: Doc; onChange: (value: Doc) => void }) {
    const [newKey, setNewKey] = useState("");
    const entries = Object.entries(value);
    const update = (key: string, next: unknown) => onChange({ ...value, [key]: next });
    return <div className="space-y-2 rounded-xl border border-zinc-800 bg-black/20 p-3">{entries.map(([key, current]) => <div key={key} className="grid gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-2 sm:grid-cols-[minmax(120px,.7fr)_minmax(160px,1fr)_auto]"><code className="self-center truncate px-2 text-xs text-zinc-400">{key}</code>{typeof current === "boolean" ? <button type="button" role="switch" aria-checked={current} onClick={() => update(key, !current)} className={`rounded-lg px-3 py-2 text-left text-xs font-medium ${current ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>{current ? "Ativado" : "Desativado"}</button> : typeof current === "number" ? <input className={inputClass} type="number" value={current} onChange={(event) => update(key, Number(event.target.value))} /> : typeof current === "string" || current == null ? <input className={inputClass} value={current == null ? "" : current} onChange={(event) => update(key, event.target.value)} /> : <textarea className={`${inputClass} font-mono text-xs`} rows={2} value={JSON.stringify(current)} onChange={(event) => { try { update(key, JSON.parse(event.target.value)); } catch { /* mantém o último valor válido */ } }} />}<button type="button" aria-label={`Remover ${key}`} onClick={() => onChange(Object.fromEntries(entries.filter(([entryKey]) => entryKey !== key)))} className="rounded-lg px-3 text-xs text-red-400 hover:bg-red-500/10">Remover</button></div>)}{entries.length === 0 ? <p className="py-2 text-center text-xs text-zinc-500">Nenhuma opção avançada configurada.</p> : null}<div className="flex gap-2 border-t border-zinc-800 pt-3"><input className={inputClass} value={newKey} placeholder="Nome da nova opção" onChange={(event) => setNewKey(event.target.value.replace(/\s+/g, "_"))} /><Button size="sm" disabled={!newKey.trim() || newKey in value} onClick={() => { const key = newKey.trim(); if (!key || key in value) return; onChange({ ...value, [key]: "" }); setNewKey(""); }}>Adicionar</Button></div></div>;
}

function CouponModalBody({ coupon, code, roles, onChange, onCodeChange, onCommit, onCancel }: {
    coupon: Doc;
    code: string | null;
    roles: DiscordGuildRole[];
    onChange: (next: Doc) => void;
    onCodeChange: (code: string) => void;
    onCommit: () => void;
    onCancel: () => void;
}) {
    const [codeText, setCodeText] = useState(code ?? "");
    const set = (key: string, next: unknown) => onChange({ ...coupon, [key]: next });
    return (
        <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
                <Field label="Código do cupom" hint="É o identificador usado na compra"><input className={inputClass} value={codeText} onChange={(e) => { setCodeText(e.target.value.toUpperCase()); onCodeChange(e.target.value.toUpperCase()); }} /></Field>
                <Field label="Tipo de desconto"><select className={inputClass} value={str(coupon.discount_type, "porcentagem")} onChange={(e) => set("discount_type", e.target.value)}><option value="porcentagem">Porcentagem (%)</option><option value="valor">Valor fixo (R$)</option></select></Field>
                <Field label={coupon.discount_type === "porcentagem" ? "Desconto (%)" : "Desconto (R$)"}><input className={inputClass} type="number" step="0.01" min="0" value={Number(coupon.discount_value ?? 0)} onChange={(e) => set("discount_value", Number(e.target.value))} /></Field>
                <Field label="Desconto máximo (R$)"><input className={inputClass} type="number" step="0.01" min="0" value={Number(coupon.max_discount ?? 0)} onChange={(e) => set("max_discount", e.target.value ? Number(e.target.value) : null)} /></Field>
                <Field label="Compra mínima (R$)"><input className={inputClass} type="number" step="0.01" min="0" value={Number(coupon.min_purchase ?? 0)} onChange={(e) => set("min_purchase", Number(e.target.value))} /></Field>
                <Field label="Compra máxima (R$)"><input className={inputClass} type="number" step="0.01" min="0" value={Number(coupon.max_purchase ?? 0)} onChange={(e) => set("max_purchase", e.target.value ? Number(e.target.value) : null)} /></Field>
                <Field label="Máximo de usos (0 = ilimitado)"><input className={inputClass} type="number" min="0" value={Number(coupon.max_uses ?? 0)} onChange={(e) => set("max_uses", Number(e.target.value))} /></Field>
                <Field label="Expiração"><input className={inputClass} type="datetime-local" value={tsToDateLocal(coupon.expiration)} onChange={(e) => set("expiration", dateLocalToTs(e.target.value))} /></Field>
                <Field label="Cargo obrigatório"><RoleSelect roles={roles} value={str(coupon.required_role)} onChange={(next) => set("required_role", next || null)} /></Field>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                <h3 className="mb-2 text-sm font-medium text-zinc-200">Uso (somente leitura)</h3>
                <p className="text-sm text-zinc-400">Usos: {Number(coupon.uses ?? 0)} · Usuários: {(Array.isArray(coupon.used_by) ? coupon.used_by.length : 0)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button onClick={onCommit}>Aplicar</Button>
            </div>
        </div>
    );
}
