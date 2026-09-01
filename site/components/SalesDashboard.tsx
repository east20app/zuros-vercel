"use client";

import { useEffect, useRef, useState } from "react";
import { Chart } from "chart.js";
import "@/lib/chart-setup";
import { getSalesOverview, type SalesOverview, type SalesRange } from "@/lib/actions/vendas.actions";
import { formatMoney } from "@/lib/status";
import { Card, Skeleton } from "./ui";

const RANGES: Array<{ key: SalesRange; label: string }> = [
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "mes", label: "Este mês" },
    { key: "tudo", label: "Tudo" },
];

const PALETTE = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#60a5fa", "#a1a1aa", "#71717a", "#34d399", "#fb7185", "#94a3b8"];

export function SalesDashboard({ appId, productName, initial }: { appId: string; productName: string; initial: SalesOverview }) {
    const [range, setRange] = useState<SalesRange>("7d");
    const [data, setData] = useState<SalesOverview>(initial);
    const [loading, setLoading] = useState(false);
    const dailyCanvasRef = useRef<HTMLCanvasElement>(null);
    const productCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartsRef = useRef<Chart[]>([]);
    // Descarta respostas de chamadas superadas quando o usuário troca o range
    // rapidamente (mesmo padrão do BotsNav/BotStatusBadge).
    const requestIdRef = useRef(0);

    useEffect(() => {
        return () => {
            chartsRef.current.forEach((chart) => chart.destroy());
            chartsRef.current = [];
        };
    }, []);

    useEffect(() => {
        const daily = dailyCanvasRef.current;
        const product = productCanvasRef.current;
        if (!daily || !product) return;

        chartsRef.current.forEach((chart) => chart.destroy());
        chartsRef.current = [];

        const tick = "#71717a";
        const grid = "rgba(161,161,170,.12)";

        const dailyChart = new Chart(daily, {
            type: "bar",
            data: {
                labels: data.byDay.map((point) => point.day),
                datasets: [
                    {
                        label: "Vendas",
                        data: data.byDay.map((point) => point.total),
                        backgroundColor: "rgba(59,130,246,.72)",
                        borderColor: "#60a5fa",
                        borderWidth: 1,
                        borderRadius: 5,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: { label: (ctx) => formatMoney(Number(ctx.raw)) },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: tick, maxRotation: 45, minRotation: 0 },
                        grid: { color: grid },
                    },
                    y: {
                        ticks: { color: tick, callback: (value) => formatMoney(Number(value)) },
                        grid: { color: grid },
                    },
                },
            },
        });

        const productChart = new Chart(product, {
            type: "doughnut",
            data: {
                labels: data.byProduct.map((item) => item.name),
                datasets: [
                    {
                        data: data.byProduct.map((item) => item.total),
                        backgroundColor: PALETTE,
                        borderColor: "rgba(0,0,0,.4)",
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: "#b9c6c8", boxWidth: 10, boxHeight: 10, padding: 12 },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const label = ctx.label || "";
                                const value = formatMoney(Number(ctx.raw));
                                return `${label}: ${value}`;
                            },
                        },
                    },
                },
            },
        });

        chartsRef.current = [dailyChart, productChart];
    }, [data]);

    function changeRange(next: SalesRange) {
        if (next === range) return;
        const requestId = ++requestIdRef.current;
        setRange(next);
        setLoading(true);
        getSalesOverview(appId, next)
            .then((overview) => {
                if (requestId !== requestIdRef.current) return; // superseded, ignore
                setData(overview);
            })
            .catch(() => {
                // mantém os dados atuais em caso de falha
            })
            .finally(() => {
                if (requestId === requestIdRef.current) setLoading(false);
            });
    }

    return (
        <div className="sales-dashboard flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-500">
                    {data.ordersCount} {data.ordersCount === 1 ? "venda registrada" : "vendas registradas"} pelo bot {productName}.
                </p>
                <div className="sales-range-picker inline-flex rounded-md border border-[#2d2d33] bg-[#171719] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
                    {RANGES.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => changeRange(option.key)}
                            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                                range === option.key
                                    ? "bg-[var(--accent)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15),0_4px_14px_-6px_rgba(59,130,246,.35)]"
                                    : "text-[#949ba4] hover:bg-white/[.06] hover:text-white"
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="grid gap-4 lg:grid-cols-3">
                    <Skeleton className="h-[260px]" />
                    <Skeleton className="h-[260px]" />
                    <Skeleton className="h-[260px]" />
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="flex flex-col gap-3 lg:col-span-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#fafafa]">
                            <span className="h-4 w-1 rounded-full bg-[#3b82f6]" />
                            Vendas por dia
                        </h3>
                        <div className="relative h-[260px]">
                            <canvas ref={dailyCanvasRef} />
                        </div>
                    </Card>
                    <Card className="flex flex-col gap-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#fafafa]">
                            <span className="h-4 w-1 rounded-full bg-[#3b82f6]" />
                            Por produto
                        </h3>
                        {data.byProduct.length === 0 ? (
                            <p className="flex h-[260px] items-center justify-center text-sm text-zinc-500">
                                Sem vendas no período.
                            </p>
                        ) : (
                            <div className="relative h-[260px]">
                                <canvas ref={productCanvasRef} />
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}
