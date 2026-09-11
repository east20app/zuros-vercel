import { DeviceNotificationSettings } from "@/components/DeviceNotificationSettings";
import { NotificationCategoryGrid } from "@/components/NotificationCategoryGrid";

export default function NotificationsPage() {
    return (
        <main className="account-page mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <section className="account-heading">
                <div><p className="home-kicker"><span className="home-kicker-mark" />CONTA / NOTIFICAÇÕES</p><h1>Alertas e aplicativo.</h1><p>Escolha como a ZUROS avisa você neste aparelho.</p></div>
                <span className="account-heading-code">ACCOUNT / NOT</span>
            </section>
            <section className="sales-chart-wrap" aria-labelledby="notification-categories-title">
                <div className="sales-section-heading">
                    <div><p className="home-section-index">01 / CENTRAL</p><h2 id="notification-categories-title">Tudo o que merece sua atenção.</h2></div>
                    <span>Vendas · pagamentos · aplicações</span>
                </div>
                <p className="mb-5 max-w-2xl text-sm leading-6 text-zinc-400">As categorias organizam os alertas do painel por contexto. As preferências abaixo controlam apenas este dispositivo.</p>
                <NotificationCategoryGrid />
            </section>
            <section className="sales-chart-wrap mt-4" aria-labelledby="notification-device-title">
                <div className="sales-status-strip mb-5">
                    <div className="sales-status-main"><span className="sales-status-dot" /><div><strong>Preferências deste aparelho</strong><small>Ative notificações web ou instale o painel para receber alertas locais.</small></div></div>
                    <span className="sales-status-chip"><i /> Configurado aqui</span>
                </div>
                <div className="sales-section-heading">
                    <div><p className="home-section-index">02 / DISPOSITIVO</p><h2 id="notification-device-title">Como a ZUROS avisa você.</h2></div>
                    <span>Notificações locais</span>
                </div>
                <DeviceNotificationSettings />
            </section>
        </main>
    );
}
