import { getSupportSettings } from "@/lib/actions/support.actions";
import { SupportPortal } from "@/components/SupportPortal";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
    const settings = await getSupportSettings();
    return <main className="support-page"><SupportPortal enabled={settings.enabled} discordInviteUrl={settings.discordInviteUrl} /></main>;
}
