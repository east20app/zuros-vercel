import { redirect } from "next/navigation";

export default function BotConfigPage({ params }: { params: { appId: string } }) {
    redirect(`/dashboard/${params.appId}/config/loja`);
}
