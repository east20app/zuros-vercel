export const BOT_CONFIG_MODULES = {
    loja: {
        config: "loja_config", products: "loja_products", preferences: "loja_preferences", massCoupons: "loja_mass_coupons",
        temporaryRoles: "loja_roles_temp", stockNotifications: "loja_stock_notifications", doubtButton: "loja_doubt_button",
        maintenance: "loja_maintenance", personalization: "loja_personalization", qrCustomization: "loja_qr_customization",
        productPreferences: "products_preferences",
    },
    protecao: {
        config: "protection_config", antifake: "antifake_config", authorized: "antifake_authorized",
        interactionMonitor: "interaction_monitor_config",
        banimentos: "protection_protecaogeral_banimentos", canais: "protection_protecaogeral_canais",
        cargos: "protection_protecaogeral_cargos", comandosExt: "protection_protecaogeral_comandosext",
        expulsoes: "protection_protecaogeral_expulsoes", webhooks: "protection_protecaogeral_webhooks",
        privatApps: "protection_privatizacoes_apps", privatCargos: "protection_privatizacoes_cargos",
        privatMencoes: "protection_privatizacoes_mencoes", privatPerms: "protection_privatizacoes_perms",
        privatPersistencia: "protection_privatizacoes_persistencia", privatUrls: "protection_privatizacoes_urls",
    },
    tickets: { config: "tickets_config" },
    giveaways: { config: "giveaways" },
    automacoes: {
        config: "automations", aiChat: "automations_ai_chat", aiModerator: "automations_ai_moderator", welcome: "automations_boas_vindas",
        clean: "automations_clean", memberCounter: "automations_cont_members", memberCounterCall: "automations_cont_members_call",
        salesCounter: "automations_cont_vendas", feedbacks: "automations_feedbacks",
        inviteTracker: "automations_invite_tracker", lockUnlock: "automations_lock_unlock", autoMessage: "automations_msg_auto", nuke: "automations_nuke",
        reactions: "automations_reactions", repost: "automations_repost", autoResponse: "automations_response_auto",
        suggestions: "automations_suggestions", topics: "automations_topics",
    },
    customizacao: { colors: "custom_colors", status: "custom_status", info: "custom_info", mode: "custom_mode" },
    configuracoes: {
        cargos: "cargos", canais: "canais", pagamentos: "payment_configs", pagamentosStatus: "pagamentos", antifake: "antifake_config",
        notificacoes: "notifications_config", blacklist: "blacklist",
    },
} as const;

export type BotConfigModule = keyof typeof BOT_CONFIG_MODULES;
export const BOT_CONFIG_MODULE_NAMES = Object.keys(BOT_CONFIG_MODULES) as BotConfigModule[];
export function isBotConfigModule(value: string): value is BotConfigModule { return value in BOT_CONFIG_MODULES; }
const DROX_RUNTIME_DOCUMENTS = [
    "loja_buys",
    "loja_customers",
    "loja_data",
    "loja_saldo_config",
    "loja_saldo_users",
    "loja_saldo_deposits",
    "payment_configs",
    "payment_tracking",
    "nubank_pending_payments",
] as const;
const allowedDocuments = new Set<string>([
    ...Object.values(BOT_CONFIG_MODULES).flatMap((documents) => Object.values(documents)),
    ...DROX_RUNTIME_DOCUMENTS,
]);
export function isAllowedBotDocument(value: string): boolean { return allowedDocuments.has(value); }
