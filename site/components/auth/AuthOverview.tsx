"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { fetchAuthStats } from "@/lib/actions/auth.actions";

interface AuthOverviewProps { licenseId: string; }
interface AuthStats { total_verified: number; new_today: number; success_rate: number; pending_role_syncs: number; gifts_active: number; recovery_running: number; daily_data: { date: string; count: number }[]; }

export default function AuthOverview({ licenseId }: AuthOverviewProps) {
  const [stats, setStats] = useState<AuthStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadStats = useCallback(() => {
    startTransition(async () => {
      try {
        const response = await fetchAuthStats(licenseId);
        if (response.ok) { setStats(response.data as unknown as AuthStats); setError(null); }
        else setError(response.error);
      } catch (err: unknown) { setError(err instanceof Error ? err.message : "Não foi possível carregar os sinais do Auth."); }
    });
  }, [licenseId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (error) return <div className="auth-inline-state auth-inline-error"><strong>O sinal não respondeu.</strong><p>{error}</p><button onClick={loadStats}>Tentar novamente <span>↗</span></button></div>;
  if (isPending || !stats) return <div className="auth-overview-loading"><div className="auth-loading-line" /><div className="auth-loading-grid">{Array.from({ length: 6 }).map((_, index) => <div key={index} />)}</div></div>;

  const cards = [
    { code: "01", label: "Membros verificados", value: stats.total_verified.toLocaleString("pt-BR"), tone: "is-lime", note: "base protegida" },
    { code: "02", label: "Entradas hoje", value: stats.new_today.toLocaleString("pt-BR"), tone: "is-coral", note: "novo movimento" },
    { code: "03", label: "Taxa de sucesso", value: `${stats.success_rate}%`, tone: "is-green", note: "fluxo concluído" },
    { code: "04", label: "Sincronizações", value: stats.pending_role_syncs.toLocaleString("pt-BR"), tone: stats.pending_role_syncs ? "is-coral" : "is-lime", note: stats.pending_role_syncs ? "pedem atenção" : "fila limpa" },
    { code: "05", label: "Gifts ativos", value: stats.gifts_active.toLocaleString("pt-BR"), tone: "is-lime", note: "acessos disponíveis" },
    { code: "06", label: "Recuperações", value: stats.recovery_running.toLocaleString("pt-BR"), tone: stats.recovery_running ? "is-coral" : "is-muted", note: stats.recovery_running ? "em andamento" : "nenhuma pendência" },
  ];
  const maxCount = Math.max(...stats.daily_data.map((day) => day.count), 1);

  return <div className="auth-overview-panel">
    <header className="auth-module-intro"><div><p className="auth-module-kicker">LEITURA DO MOMENTO</p><h3>Como o acesso está se comportando.</h3></div><button className="auth-refresh-action" onClick={loadStats} aria-label="Atualizar sinais">Atualizar <span>↻</span></button></header>
    <div className="auth-signal-grid">{cards.map((card) => <article key={card.code} className={`auth-signal-card ${card.tone}`}><div><span>{card.code}</span><i /></div><p>{card.label}</p><strong>{card.value}</strong><small>{card.note}</small></article>)}</div>
    {stats.daily_data.length > 0 && <section className="auth-activity-strip"><header><div><p className="auth-module-kicker">ÚLTIMOS 7 DIAS</p><h3>Ritmo de verificações</h3></div><span>{stats.daily_data.reduce((sum, day) => sum + day.count, 0).toLocaleString("pt-BR")} eventos</span></header><div className="auth-bars" aria-label="Verificações por dia">{stats.daily_data.map((day) => <div key={day.date} title={`${day.date}: ${day.count}`}><span>{day.count}</span><i style={{ height: `${Math.max((day.count / maxCount) * 100, 3)}%` }} /><small>{day.date.slice(5)}</small></div>)}</div></section>}
  </div>;
}
