"use client";

import { useState } from "react";
import { listOrders, type OrderEntry, type OrderFilters } from "@/lib/actions/vendas.actions";
import { STATUS_LABELS, STEP_LABELS } from "@/lib/vendas";
import { formatMoney } from "@/lib/status";
import { Card, Empty, Spinner, StatusBadge, UserChip, inputClass } from "./ui";

export function OrdersList({ appId, initial }: { appId: string; initial: OrderEntry[] }) {
    const [filters, setFilters] = useState<OrderFilters>({});
    const [orders, setOrders] = useState<OrderEntry[]>(initial);
    const [loading, setLoading] = useState(false);

    function apply(next: OrderFilters) {
        setFilters(next);
        setLoading(true);
        listOrders(appId, next)
            .then(setOrders)
            .catch(() => {
                // mantém a listagem atual em caso de falha
            })
            .finally(() => setLoading(false));
    }

    const selectClass = `${inputClass} w-auto py-2 text-xs`;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-white/[.08] bg-[#232428]/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
                    {([["", "Tudo"], ["buy", "Compras"], ["renew", "Renovações"]] as const).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => apply({ ...filters, type: value || "all" })}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                                (filters.type || "all") === (value || "all")
                                    ? "bg-[#7c3aed] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15),0_4px_14px_-6px_rgba(0,0,0,.6)]"
                                    : "text-[#949ba4] hover:bg-white/[.06] hover:text-white"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <select
                    className={selectClass}
                    value={filters.step || ""}
                    onChange={(e) => apply({ ...filters, step: e.target.value || undefined })}
                >
                    <option value="">Todos os passos</option>
                    {Object.entries(STEP_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
                <select
                    className={selectClass}
                    value={filters.status || ""}
                    onChange={(e) => apply({ ...filters, status: e.target.value || undefined })}
                >
                    <option value="">Todos os status</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
                {loading && <Spinner />}
            </div>

            {orders.length === 0 ? (
                <Empty text="Nenhum pedido encontrado com os filtros atuais." />
            ) : (
                <Card className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase tracking-wide text-zinc-500">
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Tipo / item</th>
                                    <th className="p-4">Usuário</th>
                                    <th className="p-4">Etapa</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Plano</th>
                                    <th className="p-4">Valor</th>
                                    <th className="p-4">Expira</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={`${order.type}-${order.id}`} className="border-b border-zinc-900 text-zinc-300 transition last:border-0 hover:bg-zinc-900/40">
                                        <td className="p-4 whitespace-nowrap">{new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                                        <td className="p-4">
                                            <span className="block font-medium text-white">{order.itemName}</span>
                                            <span className="text-xs text-zinc-500">{order.type === "renew" ? "Renovação" : "Compra"}</span>
                                        </td>
                                        <td className="p-4"><UserChip userId={order.userId} /></td>
                                        <td className="p-4">
                                            <StatusBadge status={order.step} label={STEP_LABELS[order.step]} />
                                        </td>
                                        <td className="p-4">
                                            <StatusBadge status={order.status} label={STATUS_LABELS[order.status]} />
                                        </td>
                                        <td className="p-4">{order.lifetime ? "Vitalício" : order.days ? `${order.days} dias` : "—"}</td>
                                        <td className="p-4 text-right font-semibold tabular-nums text-emerald-300">{formatMoney(order.finalPrice || order.price)}</td>
                                        <td className="p-4 whitespace-nowrap">{order.expiresAt ? new Date(order.expiresAt).toLocaleDateString("pt-BR") : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
