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
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40 select-none";
    const variants: Record<string, string> = {
        primary:
            "border border-[var(--accent)] bg-[var(--accent)] text-[#091116] hover:bg-[var(--accent-strong)]",
        success:
            "border border-[var(--success)]/60 bg-[var(--success)] text-white hover:bg-[var(--success)]/80",
        secondary:
            "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]",
        danger:
            "border border-[var(--danger)]/60 bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80",
        ghost: "text-[var(--muted)] hover:bg-white/[.06] hover:text-white",
        outline:
            "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)] hover:text-white",
    };
    const sizes: Record<string, string> = {
        sm: "min-h-8 px-3 py-1.5 text-xs",
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
                <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
            </div>
            {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
        </div>
    );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <div className={`zuros-card p-5 ${className}`}>
            {children}
        </div>
    );
}

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
        <div className={`relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>
            {accent && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 rounded-r" style={{ backgroundColor: accent }} />}
            {(title || actions) && (
                <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                        {icon && <span className="text-[var(--muted)]">{icon}</span>}
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
        green: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/30",
        red: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30",
        amber: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30",
        blue: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30",
        zinc: "bg-white/[.05] text-[var(--muted)] border-[var(--border)]",
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
        <span title={userId || "ID indisponível"} className="inline-flex max-w-[180px] items-center gap-2 rounded-full border border-[var(--border)] bg-white/[.04] py-1 pl-1 pr-2.5 text-xs text-[var(--muted)]">
            {avatarUrl ? <span aria-hidden="true" className="h-6 w-6 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${avatarUrl})` }} /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-[#091116]">{label.charAt(0).toUpperCase()}</span>}
            <span className="truncate font-medium">{label}</span>
        </span>
    );
}

export function TechnicalId({ value, label }: { value: string | null | undefined; label?: string }) {
    if (!value) return <span className="text-[var(--muted-dim)]">—</span>;
    return <span title={value} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted-dim)]"><Icon name="copy" className="h-3 w-3" />{label ? `${label} · ` : ""}{value.slice(0, 6)}…{value.slice(-4)}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
    return (
        <div className="flex flex-col gap-1.5 border-b border-[var(--border)] bg-[var(--surface)] p-4">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-dim)]">
                <i className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]/80" />
                {label}
            </span>
            <span className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{value}</span>
            {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
        </div>
    );
}

export function Spinner() {
    return (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)]/25 border-t-[var(--accent)]" />
    );
}

export function Skeleton({ className = "" }: { className?: string }) {
    return <div aria-hidden="true" className={`skeleton rounded ${className}`} />;
}

export function DiscordSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3" aria-label="Carregando">
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
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
        <nav className={`inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 ${className}`}>
            {items.map((item) => (
                <Link
                    key={`${item.href}:${item.label}`}
                    href={item.href}
                    className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all ${
                        item.active
                            ? "bg-[var(--accent)] text-[#091116]"
                            : "text-[var(--muted)] hover:bg-white/[.06] hover:text-white"
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
        <div className="zuros-card flex flex-col items-center justify-center border-dashed px-5 py-14 text-center">
            {icon && (
                <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] text-2xl text-[var(--accent)]">
                    {icon}
                </span>
            )}
            <p className="text-sm font-medium text-[var(--foreground)]">{title || text}</p>
            {title && text && <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--muted)]">{text}</p>}
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
            <span className="text-sm font-medium text-[var(--muted)]">{label}</span>
            {children}
            {hint && <span className="text-xs text-[var(--muted-dim)]">{hint}</span>}
        </label>
    );
}

export const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted-dim)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10";

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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-dim)] transition hover:text-[var(--muted)]"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                ref={panelRef}
                className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 animate-fade-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-5 flex shrink-0 items-center justify-between">
                    <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
                        <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[var(--muted)] transition hover:border-[var(--border)] hover:bg-white/[.06] hover:text-white"
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
            <p className="text-sm leading-6 text-[var(--muted)]">{message}</p>
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

export function StatusChip({ status, label }: { status: string | null | undefined; label?: string }) {
    const tone = getStatusTone(status);
    const tones: Record<string, string> = {
        green: "border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]",
        red: "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-[var(--danger)]",
        amber: "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-[var(--warning)]",
        blue: "border-[var(--info)]/30 bg-[var(--info-soft)] text-[var(--info)]",
        zinc: "border-[var(--border)] bg-white/[.04] text-[var(--muted)]",
    };
    return <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${tones[tone] || tones.zinc}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{label || getStatusLabel(status)}</span>;
}

export function MetricStrip({ items, className = "" }: { items: Array<{ label: string; value: ReactNode; detail?: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }>; className?: string }) {
    const tones = { neutral: "text-[var(--foreground)]", success: "text-[var(--success)]", warning: "text-[var(--warning)]", danger: "text-[var(--danger)]" };
    return <div className={`grid overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-2 xl:grid-cols-4 ${className}`}>{items.map((item) => <div key={item.label} className="min-w-0 border-b border-[var(--border)] px-4 py-3 last:border-0 sm:nth-[2n]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"><span className="block truncate text-[10px] font-medium uppercase tracking-[.12em] text-[var(--muted-dim)]">{item.label}</span><strong className={`mt-1 block truncate text-xl font-semibold tracking-tight ${tones[item.tone || "neutral"]}`}>{item.value}</strong>{item.detail && <span className="mt-0.5 block truncate text-[11px] text-[var(--muted-dim)]">{item.detail}</span>}</div>)}</div>;
}

export function DataToolbar({ search, onSearch, placeholder = "Buscar...", filters, actions }: { search?: string; onSearch?: (value: string) => void; placeholder?: string; filters?: ReactNode; actions?: ReactNode }) {
    return <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1"><input aria-label={placeholder} value={search ?? ""} onChange={(event) => onSearch?.(event.target.value)} placeholder={placeholder} className={`${inputClass} h-9 border-transparent bg-[var(--background)] py-2 text-xs focus:border-[var(--info)] focus:bg-[var(--background)]`} /></div>{filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}{actions && <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>}</div>;
}

export function ResourceRow({ icon, title, description, meta, status, actions, href }: { icon?: ReactNode; title: string; description?: ReactNode; meta?: ReactNode; status?: ReactNode; actions?: ReactNode; href?: string }) {
    const content = <><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--muted)]">{icon || <Icon name="dashboard" className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium text-[var(--foreground)]">{title}</strong>{description && <span className="mt-0.5 block truncate text-xs text-[var(--muted-dim)]">{description}</span>}</span>{status && <span className="shrink-0">{status}</span>}{meta && <span className="hidden shrink-0 text-xs text-[var(--muted-dim)] md:block">{meta}</span>}{actions && <span className="shrink-0">{actions}</span>}</>;
    return href ? <Link href={href} className="group flex min-w-0 items-center gap-3 border-b border-[var(--border)] px-3 py-3 transition-colors last:border-0 hover:bg-white/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--info)]">{content}</Link> : <div className="group flex min-w-0 items-center gap-3 border-b border-[var(--border)] px-3 py-3 last:border-0">{content}</div>;
}

export function EntityList({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>{children}</div>;
}
