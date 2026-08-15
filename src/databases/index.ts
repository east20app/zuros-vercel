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

const databases = {
    userSettings, globalSettings, products, coupons, cartsBuy, applications, extracts, stores, cartsRenew, siteUsers
}

// O Next importa os módulos das rotas durante o build para descobrir metadados.
// Abrir o Mongo nessa fase mantém os workers vivos e faz o deploy da Vercel
// travar depois da compilação. Em runtime NEXT_PHASE não possui este valor.
if (process.env.NEXT_PHASE !== "phase-production-build") {
    void connection();
}
export default databases;
