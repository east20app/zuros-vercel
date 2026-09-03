"use client";

import type { SettingsView } from "@/lib/types";
import { saveStorePaymentConfig } from "@/lib/actions/vendas.actions";
import { Badge, Card } from "./ui";
import { PaymentGatewayForm } from "./PaymentGatewayForm";

export function StorePaymentForm({ appId, settings }: { appId: string; settings: SettingsView }) {
    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col gap-4 lg:col-span-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
                    Gateway de pagamento
                </h3>
                <PaymentGatewayForm settings={settings} allowedGateways={["efi", "manual"]} onSave={async (gateway, credentials) => { await saveStorePaymentConfig(appId, gateway, credentials); }} />
            </Card>

            <Card className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="h-4 w-1 rounded-full bg-gradient-to-b from-zinc-500 to-zinc-700" />
                    Status
                </h3>
                <div className="divide-y divide-white/[.04] text-sm">
                    <div className="flex items-center justify-between py-2">
                        <span className="text-zinc-500">Gateway atual</span>
                        <Badge tone={settings.paymentGateway ? "blue" : "zinc"}>
                            {settings.paymentGateway === "efi" ? "EFI" : settings.paymentGateway === "promisse" ? "PromissePay" : settings.paymentGateway === "manual" ? "Manual" : "Não configurado"}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-zinc-500">EFI</span>
                        <Badge tone={settings.efiConfigured ? "green" : "zinc"}>{settings.efiConfigured ? (settings.efiValid ? "Válido" : "Configurado") : "Não configurado"}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-zinc-500">Manual (PIX)</span>
                        <Badge tone={settings.manualConfigured ? "green" : "zinc"}>{settings.manualConfigured ? "Configurado" : "Não configurado"}</Badge>
                    </div>
                </div>
            </Card>
        </div>
    );
}
