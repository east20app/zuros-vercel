import { Icon } from "./Icon";

const categories = [
    { label: "Vendas", description: "Pedidos e atividade comercial", icon: "dashboard" as const },
    { label: "Pagamentos", description: "PIX, confirmações e pendências", icon: "invoice" as const },
    { label: "Aplicações", description: "Status e validade dos bots", icon: "apps" as const },
    { label: "Atualizações", description: "Releases disponíveis", icon: "settings" as const },
    { label: "Sistema", description: "Saúde e avisos da plataforma", icon: "bell" as const },
];

export function NotificationCategoryGrid() {
    return (
        <div className="notification-category-grid" aria-label="Categorias de notificações">
            {categories.map((category, index) => (
                <div className={`notification-category ${index === 0 ? "is-active" : ""}`} key={category.label}>
                    <Icon name={category.icon} className="h-4 w-4 text-[var(--accent)]" />
                    <strong>{category.label}</strong>
                    <span>{category.description}</span>
                </div>
            ))}
        </div>
    );
}
