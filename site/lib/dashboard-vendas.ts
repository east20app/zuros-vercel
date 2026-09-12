import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionError } from "@/lib/actions/context";
import { getVendasContext, type VendasContext } from "@/lib/actions/vendas.actions";
import { requireUser } from "@/lib/require-admin";

export async function requireVendasContext(appId: string): Promise<VendasContext> {
    await requireUser();
    try { return await getVendasContext(appId); }
    catch (error) { if (error instanceof ActionError) notFound(); throw error; }
}
export async function vendasMetadata(appId: string, label: string, description: (botName: string) => string): Promise<Metadata> {
    try { const ctx = await getVendasContext(appId); return { title: `${label} · ${ctx.botName} · ZUROS APP`, description: description(ctx.botName) }; }
    catch { return { title: `${label} · ZUROS APP` }; }
}
