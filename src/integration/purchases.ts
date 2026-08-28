import { Types } from "mongoose";
import databases from "../databases";
import efiWrapper from "../functions/efi_wrapper";
import promisseWrapper from "../functions/promisse_wrapper";
import sharpifyWrapper from "../functions/sharpify_wrapper";
import sdkWrapper from "../functions/camposcloud-sdk";
import { changeBalance } from "../functions/extracts";
import type { IProducts } from "../databases/schemas/products";
import { confirmPaymentByExternalId } from "./payment-confirmation";
import type { ProductCatalogDTO, PurchaseCartDTO, PurchasePlan, PurchasePriceDTO, StoreCatalogDTO } from "./dtos";

export const PURCHASE_CART_EXPIRES_MINUTES = 30;
export const PIX_TAX_PERCENT = 1.2;
type PaymentGateway = "efi" | "manual" | "promisse" | "sharpify";

export function resolvePaymentGateway(settings: {
    payment_gateway?: PaymentGateway | null;
    efi_credentials?: { client_id?: string; client_secret?: string; pix_key?: string; cert?: string };
    manual_payment_credentials?: { pix_key?: string; key_type?: string };
    promissepay_credentials?: { api_key?: string };
    sharpify_credentials?: { client_id?: string; client_secret?: string };
}): PaymentGateway | null {
    if (settings.payment_gateway) return settings.payment_gateway;
    if (settings.sharpify_credentials?.client_id && settings.sharpify_credentials?.client_secret) return "sharpify";
    if (settings.promissepay_credentials?.api_key) return "promisse";
    if (settings.efi_credentials?.client_id && settings.efi_credentials?.client_secret && settings.efi_credentials?.pix_key) return "efi";
    if (settings.manual_payment_credentials?.pix_key && settings.manual_payment_credentials?.key_type) return "manual";
    return null;
}

export function calculatePixPrice(price: number, couponDiscount = 0): { net: number; charged: number } {
    if (!Number.isFinite(price) || price < 0) throw new Error("Preço inválido.");
    if (!Number.isFinite(couponDiscount) || couponDiscount < 0 || couponDiscount > 100) throw new Error("Desconto inválido.");
    const net = price * (1 - couponDiscount / 100);
    return { net, charged: net / (1 - PIX_TAX_PERCENT / 100) };
}

/**
 * Transição idempotente usada tanto pelos webhooks quanto pelo polling de segurança.
 * O filtro por `waiting-payment` garante que notificações repetidas não entreguem/creditam duas vezes.
 */
export async function confirmCartPayment(input: { paymentId: string; type?: "buy" | "renew"; provider?: "efi" | "promisse" | "sharpify" | "manual"; source?: "webhook" | "polling" | "manual" }) {
    const targets = input.type ? [input.type] : ["buy", "renew"] as const;
    for (const cartType of targets) {
        const model = cartType === "buy" ? databases.cartsBuy : databases.cartsRenew;
        const cart = await (model as any).findOne({ paymentId: input.paymentId }, { storeId: 1 }).lean();
        if (!cart) continue;
        const store = await databases.stores.findById(cart.storeId, { ownerId_campos: 1 }).lean();
        const owner = store ? await databases.userSettings.findOne({ userId_campos: store.ownerId_campos }, { payment_gateway: 1 }).lean() : null;
        const provider = input.provider || owner?.payment_gateway;
        if (!provider) return { status: "rejected" as const, cartId: String(cart._id), reason: "gateway_not_configured" };
        return confirmPaymentByExternalId({ externalPaymentId: input.paymentId, cartType, provider, source: input.source || "polling" });
    }
    return { status: "rejected" as const, cartId: "", reason: "cart_not_found" };
}

const plans: Record<PurchasePlan, { days: number | null; label: string }> = {
    weekly: { days: 7, label: "Semanal · 7 dias" },
    biweekly: { days: 15, label: "Quinzenal · 15 dias" },
    monthly: { days: 30, label: "Mensal · 30 dias" },
    lifetime: { days: null, label: "Vitalício" },
};

function productPrices(product: IProducts): PurchasePriceDTO[] {
    return (Object.keys(plans) as PurchasePlan[]).flatMap((plan) => {
        const price = product.prices?.[plan];
        return typeof price === "number" && price > 0 ? [{ plan, price, ...plans[plan] }] : [];
    });
}

export async function listStoreProducts(storeId: string): Promise<ProductCatalogDTO[]> {
    if (!Types.ObjectId.isValid(storeId)) return [];
    const products = await databases.products.find(
        { storeId },
        { storeId: 1, name: 1, productType: 1, prices: 1, messageSettings: 1, currentReleaseVersion: 1 },
    ).lean();
    return products.flatMap((product) => {
        const prices = productPrices(product);
        if (!prices.length) return [];
        return [{
            id: product._id.toString(),
            storeId: product.storeId.toString(),
            name: product.name,
            productType: product.productType || "bot",
            description: product.messageSettings?.description || null,
            bannerUrl: product.messageSettings?.banner || null,
            available: product.productType === "auth" || Boolean(product.currentReleaseVersion),
            prices,
        }];
    });
}

export async function listStoreCatalogs(): Promise<StoreCatalogDTO[]> {
    const stores = await databases.stores.find({}, { name: 1 }).sort({ name: 1 }).lean();
    const catalogs = await Promise.all(stores.map(async (store) => ({
        id: store._id.toString(),
        name: store.name,
        products: await listStoreProducts(store._id.toString()),
    })));
    return catalogs.filter((store) => store.products.length > 0);
}

async function validateStoreCheckout(storeId: string, needsHosting = true) {
    const store = await databases.stores.findById(storeId).lean();
    if (!store) throw new Error("Loja não encontrada. Por favor, contate o administrador do servidor.");
    const owner = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos }).lean();
    if (!owner) throw new Error("Configuração do dono da loja não encontrada. Por favor, contate o administrador do servidor.");

    const paymentGateway = resolvePaymentGateway(owner);
    if (paymentGateway) owner.payment_gateway = paymentGateway;

    if (paymentGateway === "efi") {
        const gateway = await efiWrapper.getInstance(owner.userId_discord);
        if (!gateway?.isValid) throw new Error("Não foi possível conectar com o gateway de pagamento. Informe um administrador.");
    } else if (paymentGateway === "manual") {
        if (!owner.manual_payment_credentials?.pix_key || !owner.manual_payment_credentials?.key_type) {
            throw new Error("O dono da loja não configurou as credenciais de pagamento manual. Por favor, contate o administrador do servidor.");
        }
    } else if (paymentGateway === "promisse") {
        if (!owner.promissepay_credentials?.api_key) {
            throw new Error("O dono da loja não configurou as credenciais do PromissePay. Por favor, contate o administrador do servidor.");
        }
        const gateway = await promisseWrapper.getInstance(owner.userId_discord).catch(() => null);
        if (!gateway?.isValid) throw new Error("Não foi possível validar a PromissePay. Confirme a API Key e os escopos payments.create e payments.read no painel administrativo.");
    } else if (paymentGateway === "sharpify") {
        const credentials = owner.sharpify_credentials;
        if (!credentials?.client_id || !credentials.client_secret) {
            throw new Error("O administrador não configurou as credenciais da Sharpify.");
        }
        const valid = await sharpifyWrapper.checkIsValidConfig({ client_id: credentials.client_id, client_secret: credentials.client_secret });
        if (!valid) throw new Error("Não foi possível validar a Sharpify. Confirme as credenciais e permissões no painel administrativo.");
    } else {
        throw new Error("Gateway de pagamento não configurado. Informe um administrador.");
    }

    if (!needsHosting) return { store, owner };
    const sdk = await sdkWrapper.getInstance(owner.userId_discord).catch(() => null);
    const usage = await sdkWrapper.getPlanUsage(owner.userId_discord).catch(() => null);
    if (!sdk?.isValid) throw new Error("Não foi possível conectar à hospedagem. Entre em contato com o suporte.");
    // O endpoint de uso pode ficar indisponível mesmo com a credencial válida.
    // Nesse caso não bloqueie a compra: createApplication fará a validação
    // definitiva de capacidade na entrega.
    if (usage && usage.freeMemoryMB < 256) throw new Error("Não há recursos disponíveis para criar uma nova aplicação no momento. Entre em contato com o suporte.");
    return { store, owner };
}

export async function createPurchaseCart(input: {
    discordId: string;
    storeId: string;
    productId: string;
    plan: PurchasePlan;
    channelId?: string;
    guildId?: string;
}): Promise<PurchaseCartDTO> {
    if (!Types.ObjectId.isValid(input.storeId) || !Types.ObjectId.isValid(input.productId)) {
        throw new Error("Produto ou loja inválido.");
    }
    const product = await databases.products.findOne({ _id: input.productId, storeId: input.storeId });
    const { owner } = await validateStoreCheckout(input.storeId, (product?.productType || "bot") !== "auth");
    if (!product) throw new Error("Produto não existe mais no banco de dados.");
    if (product.productType !== "auth" && !product.currentReleaseVersion) throw new Error("Este produto não possui uma versão de release definida. Por favor, contate o administrador do servidor.");
    const selected = productPrices(product).find((price) => price.plan === input.plan);
    if (!selected) throw new Error("Preço não definido para o plano selecionado.");

    // No painel o carrinho antigo não possui thread/canal ativo, então cancele-o
    // automaticamente e permita iniciar uma nova compra (equivalente ao fluxo do bot).
    await databases.cartsBuy.updateMany({ userId: input.discordId, status: "opened" }, { $set: { status: "cancelled" } });

    const id = new Types.ObjectId();
    const expiresAt = new Date(Date.now() + PURCHASE_CART_EXPIRES_MINUTES * 60_000);
    const cart = await databases.cartsBuy.create({
        _id: id,
        automaticPayment: owner.payment_gateway !== "manual",
        channelId: input.channelId || `web:${id.toString()}`,
        guildId: input.guildId || "web",
        storeId: input.storeId,
        userId: input.discordId,
        productId: input.productId,
        price: selected.price,
        days: selected.days ?? undefined,
        lifetime: input.plan === "lifetime",
        step: "select-coupons",
        expiresAt,
    });

    return {
        id: cart._id.toString(), storeId: input.storeId, productId: input.productId,
        productName: product.name, productType: product.productType || "bot", plan: input.plan, days: selected.days,
        lifetime: input.plan === "lifetime", price: selected.price,
        status: cart.status, step: cart.step, expiresAt: expiresAt.toISOString(),
    };
}

export async function getPurchaseCart(discordId: string, cartId: string): Promise<PurchaseCartDTO | null> {
    if (!Types.ObjectId.isValid(cartId)) return null;
    const cart = await databases.cartsBuy.findOne({ _id: cartId, userId: discordId }).populate("productId");
    if (!cart) return null;
    const product = cart.productId as unknown as IProducts;
    const plan = (cart.lifetime ? "lifetime" : cart.days === 30 ? "monthly" : cart.days === 15 ? "biweekly" : "weekly") as PurchasePlan;
    return {
        id: cart._id.toString(), storeId: cart.storeId.toString(), productId: product._id.toString(),
        productName: product.name, productType: product.productType || "bot", plan, days: cart.days ?? null, lifetime: !!cart.lifetime,
        price: cart.price || 0, status: cart.status, step: cart.step,
        expiresAt: cart.expiresAt.toISOString(),
    };
}
