import { redirect } from "next/navigation";

export default async function BotConfigPage({ params }: { params: Promise<{ appId: string }> }) { const resolvedParams = await params;
    redirect(`/dashboard/${resolvedParams.appId}/config/loja`);
}
