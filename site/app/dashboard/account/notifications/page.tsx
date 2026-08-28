import { DeviceNotificationSettings } from "@/components/DeviceNotificationSettings";

export default function NotificationsPage() {
    return (
        <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
            <div className="flex items-center gap-2.5"><span className="h-6 w-1 rounded-full bg-gradient-to-b from-violet-400 to-purple-600" /><h1 className="text-3xl font-semibold tracking-tight text-white">Notificações e aplicativo</h1></div>
            <p className="mt-2 text-sm text-zinc-500">Instale o ZUROS e controle os alertas deste aparelho.</p>
            <div className="mt-8"><DeviceNotificationSettings /></div>
        </main>
    );
}