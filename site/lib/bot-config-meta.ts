import type { BotConfigModule } from "./bot-config";
import type { IconName } from "@/components/Icon";

export const BOT_MODULE_META: Record<BotConfigModule, { icon: IconName; name: string; description: string }> = {
    loja: { icon: "store", name: "Configurar Loja", description: "Vitrine, cupons e preferências da loja" },
    protecao: { icon: "shield", name: "Proteção anti-raid", description: "Anti-raid, privatizações e monitor de webhooks" },
    tickets: { icon: "ticket", name: "Gerenciar Ticket", description: "Categorias, mensagens e equipe" },
    giveaways: { icon: "coupon", name: "Sorteios", description: "Mensagens e regras de participação" },
    automacoes: { icon: "settings", name: "Automações", description: "Autorole, DM, repost e integrações" },
    customizacao: { icon: "bot", name: "Personalização", description: "Cor, atividade e perfil do bot" },
    configuracoes: { icon: "settings", name: "Configurações", description: "Cargos, canais, pagamentos, anti-fake e blacklist" },
};
