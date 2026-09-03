"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { getStatusLabel, getStatusTone } from "@/lib/status";
import { Icon } from "./Icon";

export function Button({
    children,
    onClick,
    type = "button",
    variant = "primary",
    size = "md",
    disabled,
    className = "",
    href,
    title,
}: {
    children: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "success";
    size?: "sm" | "md";
    disabled?: boolean;
    className?: string;
    href?: string;
    title?: string;
}) {
    const base =
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 select-none";
    const variants: Record<string, string> = {
        primary:
            "border border-[var(--accent)] bg-[var(--accent)] text-[#091116] hover:border-[#e6ff95] hover:bg-[#e6ff95]",
        success:
            "border border-[#23a559]/70 bg-[#23a559] text-white shadow-[0_4px_18px_-8px_rgba(35,165,89,.6)] hover:border-[#1e8b4d]/70 hover:bg-[#1e8b4d] hover:-translate-y-px",
        secondary:
            "border border-white/[.12] bg-transparent text-[#f4f4f5] hover:border-white/[.22] hover:bg-white/[.05]",
        danger:
            "border border-[#ff745a]/70 bg-[#ff745a] text-[#091116] hover:border-[#ff957f]/70 hover:bg-[#ff957f]",
        ghost: "text-[#b5c2c6] hover:bg-white/[.06] hover:text-white",
        outline:
            "border border-[#4e606a] text-[#b5c2c6] shadow-[inset_0_1px_0_rgba(255,255,255,.03)] hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/10 hover:text-white",
    };
    const sizes: Record<string, string> = {
        sm: "min-h-9 px-3 py-1.5 text-xs",
        md: "min-h-10 px-4 py-2.5 text-sm",
    };

    if (href) {
        const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
        if (disabled) {
            return (
                <span aria-disabled="true" title={title} className={`${classes} cursor-not-allowed opacity-40`}>
                    {children}
                </span>
            );
        }
        return <Link href={href} title={title} className={classes}>{children}</Link>;
    }

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        >
            {children}
        </button>
    );
}

export function PageHeader({
    title,
    subtitle,
    actions,
}: {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
                <div className="flex items-center gap-2.5"><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1></div>
                {subtitle && <p className="mt-1.5 text-sm text-[#949ba4]">{subtitle}</p>}
            </div>
            {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
        </div>
    );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={`zuros-card p-5 ${className}`}
        >
            {children}
        </div>
    );
}

/** Container v2 do Discord: borda suave, fundo #232428 e accent lateral opcional. */
export function DiscordCard({
    title,
    icon,
    accent = "var(--accent)",
    actions,
    children,
    className = "",
}: {
    title?: string;
    icon?: ReactNode;
    accent?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`relative overflow-hidden rounded-xl border border-white/[.12] bg-[#15191a] ${className}`}>
            {accent && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 rounded-r" style={{ backgroundColor: accent }} />}
            {(title || actions) && (
                <header className="flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[#f2f3f5]">
                        {icon && <span className="text-[#b5bac1]">{icon}</span>}
                        {title}
                    </h3>
                    {actions && <div className="flex items-center gap-1.5">{actions}</div>}
                </header>
            )}
            <div className="p-4">{children}</div>
        </div>
    );
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "green" | "red" | "amber" | "zinc" | "blue" }) {
    const tones: Record<string, string> = {
        green: "bg-[#23a559]/12 text-[#2fc06a] border-[#23a559]/40",
        red: "bg-[#f23f43]/12 text-[#f97175] border-[#f23f43]/40",
        amber: "bg-[#f0b232]/12 text-[#f8c25c] border-[#f0b232]/40",
        blue: "bg-[var(--accent)]/12 text-[var(--accent-strong)] border-[var(--accent)]/40",
        zinc: "bg-white/[.05] text-[#b5bac1] border-white/[.08]",
    };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
            {children}
        </span>
    );
}

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
    return <Badge tone={getStatusTone(status)}><i className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />{label || getStatusLabel(status)}</Badge>;
}

export function UserChip({ userId, name, avatarUrl }: { userId: string; name?: string | null; avatarUrl?: string | null }) {
    const suffix = userId ? userId.slice(-4) : "----";
    const label = name || `Usuário •${suffix}`;
    return (
        <span title={userId || "ID indisponível"} className="inline-flex max-w-[180px] items-center gap-2 rounded-full border border-white/[.08] bg-white/[.04] py-1 pl-1 pr-2.5 text-xs text-[#b5bac1]">
            {avatarUrl ? <span aria-hidden="true" className="h-6 w-6 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${avatarUrl})` }} /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-[#091116]">{label.charAt(0).toUpperCase()}</span>}
            <span className="truncate font-medium">{label}</span>
        </span>
    );
}

export function TechnicalId({ value, label }: { value: string | null | undefined; label?: string }) {
    if (!value) return <span className="text-[#72767d]">—</span>;
    return <span title={value} className="inline-flex items-center gap-1.5 text-[11px] text-[#72767d]"><Icon name="copy" className="h-3 w-3" />{label ? `${label} · ` : ""}{value.slice(0, 6)}…{value.slice(-4)}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
    return (
        <div className="flex flex-col gap-1.5 border-b border-white/[.12] bg-[#15191a] p-4">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#949ba4]">
                <i className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/80 transition group-hover:bg-[var(--accent)] group-hover:shadow-[0_0_10px_rgba(214,255,99,.75)]" />
                {label}
            </span>
            <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
            {hint && <span className="text-xs text-[#949ba4]">{hint}</span>}
        </div>
    );
}

export function Spinner() {
    return (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)]/25 border-t-[var(--accent)]" />
    );
}

/** Skeleton identico ao loading do app desktop do Discord. */
export function Skeleton({ className = "" }: { className?: string }) {
    return <div aria-hidden="true" className={`skeleton rounded ${className}`} />;
}

export function DiscordSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3" aria-label="Carregando">
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg border border-white/[.04] bg-[#232428] p-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-2/5" />
                        <Skeleton className="h-3 w-3/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export interface PillTabItem { label: string; href: string; active?: boolean }
export function PillTabs({ items, className = "" }: { items: PillTabItem[]; className?: string }) {
    return (
        <nav className={`inline-flex items-center gap-1 rounded-lg border border-white/[.08] bg-[#232428]/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.03)] ${className}`}>
            {items.map((item) => (
                <Link
                    key={`${item.href}:${item.label}`}
                    href={item.href}
                    className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all ${
                        item.active
                            ? "bg-[var(--accent)] text-[#091116] shadow-[inset_0_1px_0_rgba(255,255,255,.15),0_4px_14px_-6px_rgba(214,255,99,.35)]"
                            : "text-[#949ba4] hover:bg-white/[.06] hover:text-white"
                    }`}
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}

export function Empty({ text, title, icon, action }: { text?: string; title?: string; icon?: ReactNode; action?: ReactNode }) {
    return (
        <div className="zuros-card zuros-card-lit flex flex-col items-center justify-center border-dashed px-5 py-14 text-center">
            {icon && (
                <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/8 text-2xl text-[var(--accent)] shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_0_30px_-10px_rgba(214,255,99,.2)]">
                    {icon}
                </span>
            )}
            <p className="text-sm font-medium text-[#f2f3f5]">{title || text}</p>
            {title && text && <p className="mt-1 max-w-sm text-xs leading-5 text-[#949ba4]">{text}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

export function Field({
    label,
    children,
    hint,
}: {
    label: string;
    children: ReactNode;
    hint?: string;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#b5bac1]">{label}</span>
            {children}
            {hint && <span className="text-xs text-[#949ba4]">{hint}</span>}
        </label>
    );
}

export const inputClass =
    "w-full rounded-lg border border-[#4e5058]/80 bg-[#1e1f22] px-3.5 py-2.5 text-sm text-[#f2f3f5] placeholder-[#72767d] shadow-[inset_0_1px_0_rgba(255,255,255,.02)] outline-none transition focus:border-[var(--accent)] focus:bg-[#16232b] focus:shadow-[0_0_0_3px_rgba(214,255,99,.16)]";

export function SecretInput({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <input
                className={inputClass}
                type={visible ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="new-password"
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 transition hover:text-zinc-300"
                aria-label={visible ? "Ocultar" : "Mostrar"}
            >
                {visible ? "Ocultar" : "Mostrar"}
            </button>
        </div>
    );
}

export function Modal({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const focusableSelector =
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)) : [];
        (focusables[0] ?? panel)?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (event.key !== "Tab" || focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
            previouslyFocused?.focus();
        };
    }, [open]);

    if (!open || typeof document === "undefined") return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                ref={panelRef}
                className="zuros-card zuros-card-lit relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden p-6 animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent" />
                <div className="mb-5 flex shrink-0 items-center justify-between">
                    <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold text-white">
                        <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#949ba4] transition hover:border-white/[.08] hover:bg-white/[.06] hover:text-white"
                    >
                        ✕
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirmar",
    danger = false,
    busy = false,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <Modal open={open} onClose={onCancel} title={title}>
            <p className="text-sm leading-6 text-[#b5bac1]">{message}</p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Button variant="ghost" disabled={busy} onClick={onCancel}>
                    Cancelar
                </Button>
                <Button variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
                    {busy ? <Spinner /> : null}
                    {confirmLabel}
                </Button>
            </div>
        </Modal>
    );
}


/** Status compacto para listas operacionais e tabelas. */
export function StatusChip({ status, label }: { status: string | null | undefined; label?: string }) {
    const tone = getStatusTone(status);
    const tones: Record<string, string> = {
        green: "border-[#23a559]/30 bg-[#23a559]/10 text-[#58d68d]",
        red: "border-[#f23f43]/30 bg-[#f23f43]/10 text-[#ff8a8d]",
        amber: "border-[#f0b232]/30 bg-[#f0b232]/10 text-[#f8c25c]",
        blue: "border-[#5B9CFF]/30 bg-[#5B9CFF]/10 text-[#8bb9ff]",
        zinc: "border-white/[.10] bg-white/[.04] text-[#a1a1aa]",
    };
    return <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${tones[tone] || tones.zinc}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{label || getStatusLabel(status)}</span>;
}

export function MetricStrip({ items, className = "" }: { items: Array<{ label: string; value: ReactNode; detail?: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }>; className?: string }) {
    const tones = { neutral: "text-white", success: "text-[#58d68d]", warning: "text-[#f8c25c]", danger: "text-[#ff8a8d]" };
    return <div className={`grid overflow-hidden rounded-xl border border-white/[.08] bg-[#15191A] sm:grid-cols-2 xl:grid-cols-4 ${className}`}>{items.map((item) => <div key={item.label} className="min-w-0 border-b border-white/[.07] px-4 py-3 last:border-0 sm:nth-[2n]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"><span className="block truncate text-[10px] font-medium uppercase tracking-[.12em] text-[#71717a]">{item.label}</span><strong className={`mt-1 block truncate text-xl font-semibold tracking-tight ${tones[item.tone || "neutral"]}`}>{item.value}</strong>{item.detail && <span className="mt-0.5 block truncate text-[11px] text-[#71717a]">{item.detail}</span>}</div>)}</div>;
}

export function DataToolbar({ search, onSearch, placeholder = "Buscar...", filters, actions }: { search?: string; onSearch?: (value: string) => void; placeholder?: string; filters?: ReactNode; actions?: ReactNode }) {
    return <div className="flex flex-col gap-2 rounded-xl border border-white/[.08] bg-[#15191A] p-2 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1"><input aria-label={placeholder} value={search ?? ""} onChange={(event) => onSearch?.(event.target.value)} placeholder={placeholder} className={`${inputClass} h-9 border-transparent bg-[#0f1112] py-2 text-xs focus:border-[#5B9CFF] focus:bg-[#0f1112]`} /></div>{filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}{actions && <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>}</div>;
}

export function ResourceRow({ icon, title, description, meta, status, actions, href }: { icon?: ReactNode; title: string; description?: ReactNode; meta?: ReactNode; status?: ReactNode; actions?: ReactNode; href?: string }) {
    const content = <><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[.08] bg-[#1C2223] text-[#a1a1aa]">{icon || <Icon name="dashboard" className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium text-[#f4f4f5]">{title}</strong>{description && <span className="mt-0.5 block truncate text-xs text-[#71717a]">{description}</span>}</span>{status && <span className="shrink-0">{status}</span>}{meta && <span className="hidden shrink-0 text-xs text-[#71717a] md:block">{meta}</span>}{actions && <span className="shrink-0">{actions}</span>}</>;
    return href ? <Link href={href} className="group flex min-w-0 items-center gap-3 border-b border-white/[.07] px-3 py-3 transition-colors last:border-0 hover:bg-white/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9CFF]">{content}</Link> : <div className="group flex min-w-0 items-center gap-3 border-b border-white/[.07] px-3 py-3 last:border-0">{content}</div>;
}

export function EntityList({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`overflow-hidden rounded-xl border border-white/[.08] bg-[#15191A] ${className}`}>{children}</div>;
}
