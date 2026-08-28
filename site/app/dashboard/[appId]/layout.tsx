import { notFound } from "next/navigation";
import { UserBotWorkspaceBar } from "@/components/UserBotWorkspaceBar";
import { getBotIdentity } from "@/lib/actions/apps.actions";
import { ActionError } from "@/lib/actions/context";

export default async function UserBotLayout({ children, params }: { children: React.ReactNode; params: Promise<{ appId: string }> }) {
    const resolvedParams = await params;
    let bot;
    try {
        bot = await getBotIdentity(resolvedParams.appId);
    } catch (error) {
        if (error instanceof ActionError) notFound();
        throw error;
    }
    const routeId = bot.botId || bot.id;
    return <><UserBotWorkspaceBar routeId={routeId} name={bot.name} productName={bot.productName} active={bot.status === "active"} />{children}</>;
}
