import connection from "./connection";
import applications from "./schemas/applications";
import cartsBuy from "./schemas/carts-buy";
import cartsRenew from "./schemas/carts-renew";
import coupons from "./schemas/coupons";
import extracts from "./schemas/extracts";
import products from "./schemas/products";
import userSettings from "./schemas/user-settings";
import globalSettings from "./schemas/global-settings";
import stores from "./schemas/stores";
import siteUsers from "./schemas/site-users";
import sharpifyEvents from "./schemas/sharpify-events";
import authLicenses from "./schemas/auth-licenses";
import paymentEvents from "./schemas/payment-events";
import ledgerOperations from "./schemas/ledger-operations";

const databases = {
    userSettings, globalSettings, products, coupons, cartsBuy, applications, extracts, stores, cartsRenew, siteUsers, sharpifyEvents, authLicenses, paymentEvents, ledgerOperations
}

// O Next importa os módulos das rotas durante o build para descobrir metadados.
// Abrir o Mongo nessa fase mantém os workers vivos e faz o deploy da Vercel
// travar depois da compilação. Em runtime NEXT_PHASE não possui este valor.
if (process.env.NEXT_PHASE !== "phase-production-build") {
    void connection().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Falha desconhecida";
        console.error("[MongoDB] Conexão inicial falhou; a próxima requisição tentará novamente:", message);
    });
}
export default databases;
