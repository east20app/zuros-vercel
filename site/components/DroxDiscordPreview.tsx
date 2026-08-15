"use client";
import { useMemo, useState } from "react";

function stringsFrom(value: unknown, result: string[] = []): string[] {
    if (typeof value === "string" && value.trim()) result.push(value);
    else if (Array.isArray(value)) value.forEach((item) => stringsFrom(item, result));
    else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach((item) => stringsFrom(item, result));
    return result;
}
const PRIORITY_KEYS = ["mensagem", "message", "content", "welcome_message", "thread_message", "rejection_message", "description", "prompt"];
function pickMessage(value: unknown): string | null {
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = pickMessage(item);
            if (found) return found;
        }
        return null;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        for (const key of PRIORITY_KEYS) {
            const raw = record[key];
            if (typeof raw === "string" && raw.trim()) return raw.trim();
        }
        for (const nested of Object.values(record)) {
            const found = pickMessage(nested);
            if (found) return found;
        }
    }
    return null;
}
function samplePlaceholders(text: string): string {
    return text
        .replace(/\{user\}/g, "@membro")
        .replace(/\{member\}/g, "@membro")
        .replace(/\{inviter\}/g, "@convidante")
        .replace(/\{invites\}/g, "3")
        .replace(/\{nameserver\}|\{server\}/g, "Meu Servidor")
        .replace(/\{servercount\}|\{members\}/g, "1.024")
        .replace(/\{bot\}/g, "@Drox");
}
function InlineMarkdown({ text }: { text: string }) {
    return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => part.startsWith("**") ? <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong> : part.startsWith("`") ? <code key={index} className="rounded bg-[#1e1f22] px-1 py-0.5 text-[#dbdee1]">{part.slice(1, -1)}</code> : part)}</>;
}
export function DiscordMarkdown({ children }: { children: string }) {
    return <div className="space-y-1 whitespace-pre-wrap break-words text-sm leading-[1.375rem] text-[#dbdee1]">{children.split(/\r?\n/).map((line, index) => {
        if (/^\s*(---+|___+)\s*$/.test(line)) return <hr key={index} className="my-3 border-[#3f4147]" />;
        if (line.startsWith("-# ")) return <p key={index} className="text-xs leading-4 text-[#949ba4]"><InlineMarkdown text={line.slice(3)} /></p>;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) return <p key={index} className={`${heading[1].length === 1 ? "text-xl" : heading[1].length === 2 ? "text-lg" : "text-base"} mt-2 font-bold text-[#f2f3f5]`}><InlineMarkdown text={heading[2]} /></p>;
        if (line.startsWith("> ")) return <p key={index} className="border-l-4 border-[#4e5058] pl-3"><InlineMarkdown text={line.slice(2)} /></p>;
        return <p key={index} className={line ? "" : "h-2"}><InlineMarkdown text={line} /></p>;
    })}</div>;
}
export function DroxContainer({ children, accent = "#5865F2", className = "" }: { children: React.ReactNode; accent?: string; className?: string }) {
    return <div className={`relative overflow-hidden rounded-lg border border-white/[.08] bg-[#2B2D31] p-4 pl-5 shadow-[0_2px_8px_rgba(0,0,0,.28)] ${className}`}><span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} />{children}</div>;
}

/** Simula o embed de mensagem do Discord, espelhando layout oficial. */
function DiscordEmbed({ title, description, color, footer }: { title: string; description: string; color: string; footer?: string }) {
    const lines = description.split("\n").filter((line) => line.trim());
    const fields: { name: string; value: string }[] = [];
    for (let index = 0; index + 1 < lines.length; index += 2) {
        fields.push({ name: lines[index], value: lines[index + 1] });
    }
    return (
        <div className="relative overflow-hidden rounded-md bg-[#2b2d31] pl-5 shadow-[0_2px_10px_rgba(0,0,0,.3)]">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
            <div className="flex flex-col gap-2 px-4 py-4">
                {title && <p className="text-base font-semibold text-[#f2f3f5]">{title}</p>}
                <p className="text-sm text-[#dbdee1]"><DiscordMarkdown>{description.split("\n").slice(0, 6).join("\n")}</DiscordMarkdown></p>
                {fields.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
                        {fields.slice(0, 6).map((field, index) => (
                            <div key={index}>
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#dbdee1]">{field.name}</p>
                                <p className="mt-0.5 text-sm text-[#dbdee1]"><DiscordMarkdown>{field.value}</DiscordMarkdown></p>
                            </div>
                        ))}
                    </div>
                )}
                {footer && (
                    <div className="mt-2 flex items-center gap-1.5 border-t border-white/[.05] pt-2 text-xs text-[#949ba4]">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm4-8h-3V8a1 1 0 1 0-2 0v5a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2Z"/></svg>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export function DroxDiscordPreview({ value, title = "Prévia do painel" }: { value: Record<string, unknown>; title?: string }) {
    const [mode, setMode] = useState<"container" | "embed">("container");
    const [copied, setCopied] = useState(false);
    const strings = useMemo(() => stringsFrom(value), [value]);
    const picked = useMemo(() => pickMessage(value), [value]);
    const content = picked
        ? samplePlaceholders(picked)
        : strings.filter((item) => !/^#[0-9a-f]{6}$/i.test(item)).slice(0, 5).join("\n") || "# Painel DROX\n-# Configure os campos para visualizar a mensagem.\n---\nAs alterações aparecem aqui em tempo real.";
    const accent = strings.find((item) => /^#[0-9a-f]{6}$/i.test(item)) || "#5865F2";
    const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    async function copyMessage() {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard indisponível */ }
    }

    return (
        <aside className="sticky top-5 overflow-hidden rounded-xl border border-white/[.08] bg-[#1e1f22] shadow-[0_18px_50px_-24px_rgba(0,0,0,.85)]" aria-label={title}>
            <div className="flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#b5bac1]">Discord · Drox</p>
                    <h2 className="truncate font-semibold text-white">{title}</h2>
                </div>
                <button
                    type="button"
                    onClick={() => void copyMessage()}
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition ${copied ? "bg-[#23a559] text-white" : "bg-[#4e5058] text-white hover:bg-[#6d6f78]"}`}
                >
                    {copied ? "Copiado!" : "Copiar"}
                </button>
            </div>
            <div className="flex gap-1 px-4 pt-3">
                <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f23f43]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f0b232]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#23a559]" />
                </div>
                <span className="ml-3 text-[11px] text-[#949ba4]"># painel-drox</span>
                <div className="ml-auto flex rounded-md bg-[#111214] p-0.5">
                    {(["container", "embed"] as const).map((item) => (
                        <button
                            type="button"
                            key={item}
                            aria-pressed={mode === item}
                            onClick={() => setMode(item)}
                            className={`rounded px-2.5 py-1 text-xs capitalize transition ${mode === item ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"}`}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>
            <div className="rounded-lg bg-[#313338] p-4">
                <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#5865F2] text-sm font-black text-white shadow-[0_0_14px_-4px_rgba(88,101,242,.8)]">D</span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <strong className="text-sm text-white">Drox Bot</strong>
                            <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">APP</span>
                            <span className="text-xs text-[#949ba4]">hoje às {now}</span>
                        </div>
                        <div className="mt-1.5">
                            {mode === "container" ? <DroxContainer accent={accent}><DiscordMarkdown>{content}</DiscordMarkdown></DroxContainer> : <DiscordEmbed title={title} description={content} color={accent} footer="Drox · Configurações sincronizadas" />}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
