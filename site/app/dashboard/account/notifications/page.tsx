import { DeviceNotificationSettings } from "@/components/DeviceNotificationSettings";

export default function NotificationsPage() {
    return (
        <main className="account-page mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <section className="account-heading"><div><p className="home-kicker"><span className="home-kicker-mark" />CONTA / NOTIFICAÇÕES</p><h1>Alertas e aplicativo.</h1><p>Instale o ZUROS e controle os alertas deste aparelho.</p></div><span className="account-heading-code">ACCOUNT / NOT</span></section>

            <div className="sales-status-strip">
                <div className="sales-status-main">
                    <span className="sales-status-dot" />
                    <div>
                        <strong>Preferências do dispositivo</strong>
                        <small>As alterações valem apenas para o aparelho que você está usando agora.</small>
                    </div>
                </div>
                <span className="sales-status-chip"><i /> Configurado aqui</span>
            </div>

            <div className="sales-chart-wrap">
                <div className="sales-section-heading">
                    <div>
                        <p className="home-section-index">01 / APARELHO</p>
                        <h2>Como o ZUROS avisa você.</h2>
                    </div>
                    <span>Notificações locais</span>
                </div>
                <DeviceNotificationSettings />
            </div>
        </main>
    );
}