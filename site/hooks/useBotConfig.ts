"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBotConfig, saveBotConfig } from "@/lib/actions/bot-config.actions";
import { botConfigSchemas, type BotConfigModule } from "@/lib/bot-config";
export type BotConfigError = { code: string; message: string; status: number };
function actionError(reason: unknown): BotConfigError { const message = reason instanceof Error ? reason.message : "Não foi possível concluir a operação"; return { code: /ativa|permissão|encontrada/i.test(message) ? "FORBIDDEN" : "DROX_UNAVAILABLE", message, status: /ativa|permissão|encontrada/i.test(message) ? 403 : 503 }; }
export function useBotConfig(appId: string, modulo: BotConfigModule) {
    const [data, setData] = useState<Record<string, unknown> | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<BotConfigError | null>(null); const request = useRef(0);
    const load = useCallback(async () => { const id = ++request.current; setLoading(true); setError(null); try { const value = await getBotConfig(appId, modulo); const parsed = botConfigSchemas[modulo].safeParse(value); if (!parsed.success) throw new Error("O DROX devolveu uma configuração incompatível."); if (id === request.current) setData(parsed.data); } catch (reason) { if (id === request.current) setError(actionError(reason)); } finally { if (id === request.current) setLoading(false); } }, [appId, modulo]);
    useEffect(() => { void load(); return () => { request.current += 1; }; }, [load]);
    const save = useCallback(async (next: Record<string, unknown>) => { const parsed = botConfigSchemas[modulo].safeParse(next); if (!parsed.success) throw { code: "INVALID_PAYLOAD", message: "Revise os dados deste módulo", status: 400 } satisfies BotConfigError; setSaving(true); try { const result = await saveBotConfig(appId, modulo, parsed.data); setData(parsed.data); return result; } catch (reason) { throw actionError(reason); } finally { setSaving(false); } }, [appId, modulo]);
    return { data, setData, loading, saving, error, reload: load, save };
}
