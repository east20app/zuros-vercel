"use client";

import { Chart, type ChartConfiguration } from "chart.js";
import { useEffect, useMemo, useRef } from "react";
import type { ExtractView } from "@/lib/types";
import "@/lib/chart-setup";

function ChartCanvas({ config, label }: { config: ChartConfiguration; label: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!canvasRef.current) return;
        const chart = new Chart(canvasRef.current, config);
        return () => chart.destroy();
    }, [config]);
    return <canvas ref={canvasRef} role="img" aria-label={label} />;
}

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" as const },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0b171d", titleColor: "#f2f6f0", bodyColor: "#b8c8c5", borderColor: "rgba(214,255,99,.35)", borderWidth: 1 } },
    scales: {
        x: { grid: { display: false }, ticks: { color: "#7f939c" }, border: { display: false } },
        y: { beginAtZero: true, grid: { color: "rgba(214,236,241,.07)" }, ticks: { color: "#7f939c" }, border: { display: false } },
    },
};

const localDayKey = (date: Date) => date.toLocaleDateString("sv-SE");

export function StatsCharts({ extracts, releases, applications }: { extracts: ExtractView[]; releases: number; applications: number }) {
    const days = useMemo(() => Array.from({ length: 7 }, (_, offset) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - offset));
        const key = localDayKey(date);
        return {
            label: date.toLocaleDateString("pt-BR", { weekday: "short" }),
            value: extracts.filter((entry) => entry.origin === "sales" && entry.action === "add" && localDayKey(new Date(entry.createdAt)) === key).reduce((sum, entry) => sum + entry.amount, 0),
        };
    }), [extracts]);
    const salesConfig = useMemo<ChartConfiguration>(() => ({
        type: "line",
        data: { labels: days.map((day) => day.label), datasets: [{ data: days.map((day) => day.value), borderColor: "#d6ff63", backgroundColor: "rgba(214,255,99,.14)", fill: true, tension: .35, pointBackgroundColor: "#d6ff63", pointRadius: 3 }] },
        options: { ...chartOptions, plugins: { ...chartOptions.plugins, tooltip: { ...chartOptions.plugins.tooltip, callbacks: { label: (context) => ` ${Number(context.raw).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` } } } },
    }), [days]);
    const volumeConfig = useMemo<ChartConfiguration>(() => ({
        type: "bar",
        data: { labels: ["Aplicações", "Releases"], datasets: [{ data: [applications, releases], backgroundColor: ["rgba(214,255,99,.72)", "rgba(255,116,90,.72)"], borderColor: ["#d6ff63", "#ff745a"], borderWidth: 1, borderRadius: 8 }] },
        options: chartOptions,
    }), [applications, releases]);

    return <div className="grid gap-4 lg:grid-cols-2">
        <section className="admin-chart-panel"><header><p className="admin-section-index">05 / PERFORMANCE</p><h2>Vendas · 7 dias</h2></header><div className="h-56"><ChartCanvas config={salesConfig} label="Gráfico de vendas dos últimos sete dias" /></div></section>
        <section className="admin-chart-panel"><header><p className="admin-section-index">06 / VOLUME</p><h2>Volume operacional</h2></header><div className="h-56"><ChartCanvas config={volumeConfig} label="Gráfico de aplicações e releases" /></div></section>
    </div>;
}
