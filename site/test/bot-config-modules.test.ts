import assert from "node:assert/strict";
import test from "node:test";
import { BOT_CONFIG_MODULES, isAllowedBotDocument, isBotConfigModule } from "../lib/bot-config-modules.ts";
import { botConfigSchemas } from "../lib/bot-config-schemas.ts";
test("allows configured modules and only confirmed DROX payment documents", () => {
    assert.equal(isBotConfigModule("loja"), true);
    assert.equal(isBotConfigModule("pagamentos"), false);
    for (const id of ["pagamentos", "payment_configs", "nubank_pending_payments", "payment_tracking"]) assert.equal(isAllowedBotDocument(id), true);
    for (const id of ["earnings", "orders"]) assert.equal(isAllowedBotDocument(id), false);
});
test("all mapped documents are whitelisted", () => { for (const documents of Object.values(BOT_CONFIG_MODULES)) for (const id of Object.values(documents)) assert.equal(isAllowedBotDocument(id), true); });
test("module schemas require every aggregate document and reject extras", () => { const data = Object.fromEntries(Object.keys(BOT_CONFIG_MODULES.tickets).map((alias) => [alias, {}])); assert.equal(botConfigSchemas.tickets.safeParse(data).success, true); assert.equal(botConfigSchemas.tickets.safeParse({ ...data, payment_configs: {} }).success, false); });
test("protecao maps every real DROX protection document", () => {
    assert.deepEqual(BOT_CONFIG_MODULES.protecao, {
        config: "protection_config",
        antifake: "antifake_config",
        authorized: "antifake_authorized",
        interactionMonitor: "interaction_monitor_config",
        banimentos: "protection_protecaogeral_banimentos",
        canais: "protection_protecaogeral_canais",
        cargos: "protection_protecaogeral_cargos",
        comandosExt: "protection_protecaogeral_comandosext",
        expulsoes: "protection_protecaogeral_expulsoes",
        webhooks: "protection_protecaogeral_webhooks",
        privatApps: "protection_privatizacoes_apps",
        privatCargos: "protection_privatizacoes_cargos",
        privatMencoes: "protection_privatizacoes_mencoes",
        privatPerms: "protection_privatizacoes_perms",
        privatPersistencia: "protection_privatizacoes_persistencia",
        privatUrls: "protection_privatizacoes_urls",
    });
});
test("loja maps every real DROX shop document", () => {
    assert.deepEqual(BOT_CONFIG_MODULES.loja, {
        config: "loja_config",
        products: "loja_products",
        preferences: "loja_preferences",
        massCoupons: "loja_mass_coupons",
        temporaryRoles: "loja_roles_temp",
        stockNotifications: "loja_stock_notifications",
        stockRequests: "loja_stock_requests",
        doubtButton: "loja_doubt_button",
        maintenance: "loja_maintenance",
        personalization: "loja_personalization",
        qrCustomization: "loja_qr_customization",
        productPreferences: "products_preferences",
        balanceConfig: "loja_saldo_config",
        saldoUsers: "loja_saldo_users",
        cashback: "loja_cashback_config",
        customers: "loja_customers",
    });
});
test("automacoes maps every real DROX automation document", () => {
    assert.deepEqual(BOT_CONFIG_MODULES.automacoes, {
        config: "automations",
        aiChat: "automations_ai_chat",
        aiModerator: "automations_ai_moderator",
        welcome: "automations_boas_vindas",
        clean: "automations_clean",
        memberCounter: "automations_cont_members",
        memberCounterCall: "automations_cont_members_call",
        salesCounter: "automations_cont_vendas",
        feedbacks: "automations_feedbacks",
        inviteTracker: "automations_invite_tracker",
        lockUnlock: "automations_lock_unlock",
        autoMessage: "automations_msg_auto",
        nuke: "automations_nuke",
        reactions: "automations_reactions",
        repost: "automations_repost",
        autoResponse: "automations_response_auto",
        suggestions: "automations_suggestions",
        topics: "automations_topics",
        disparadorDm: "automations_disparador_dm",
        forms: "automations_forms",
    });
});
test("customizacao maps every real DROX customization document", () => {
    assert.deepEqual(BOT_CONFIG_MODULES.customizacao, {
        colors: "custom_colors",
        status: "custom_status",
        info: "custom_info",
        mode: "custom_mode",
    });
});
test("extensions maps every real DROX extension document", () => {
    assert.deepEqual(BOT_CONFIG_MODULES.extensions, {
        config: "extensions_config",
        droxgen: "extensions_droxgen",
        boostData: "extensions_boost_data",
        boostStock: "extensions_boost_stock",
        subscriptions: "extensions_subscriptions",
        pendingPayments: "extensions_pending_payments",
        paymentHistory: "extensions_payment_history",
    });
});

test("allows every runtime document used by the current DROX build", () => {
    for (const id of ["antifake_logs", "automations_feedbacks_log", "bot_connection", "convites", "loja_stock_requests", "products", "tickets_calls", "tickets_data"]) {
        assert.equal(isAllowedBotDocument(id), true, id);
    }
});