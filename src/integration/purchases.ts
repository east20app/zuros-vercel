import { Types } from "mongoose";
import databases from "../databases";
import efiWrapper from "../functions/efi_wrapper";
import promisseWrapper from "../functions/promisse_wrapper";
import sdkWrapper from "../functions/camposcloud-sdk";
import { changeBalance } from "../functions/extracts";
import type { IProducts } from "../databases/schemas/products";
import type { ProductCatalogDTO, PurchaseCartDTO, PurchasePlan, PurchasePriceDTO, StoreCatalogDTO } from "./dtos";

export const PURCHASE_CART_EXPIRES_MINUTES = 30;
export const PIX_TAX_PERCENT = 1.2;

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
export async function confirmCartPayment(input: { paymentId: string; type?: "buy" | "renew" }) {
    if (!input.paymentId) throw new Error("Identificador de pagamento ausente.");
    const targets = input.type === "buy" ? ["buy"] : input.type === "renew" ? ["renew"] : ["buy", "renew"];
    if (targets.includes("buy")) {
        const cart = await databases.cartsBuy.findOneAndUpdate(
            { paymentId: input.paymentId, status: "opened", step: "waiting-payment" },
            { $set: { status: "processing" } }, { new: true },
        ).populate("coupon");
        if (cart) {
            try {
                const discount = (cart.coupon as unknown as { discount?: number } | null)?.discount || 0;
                const { net } = calculatePixPrice(cart.price, discount);
                await changeBalance({ action: "add", amount: net, origin: "sales", description: `Carrinho pago por ${cart.userId}`, storeId: String(cart.storeId) });
                await databases.cartsBuy.updateOne({ _id: cart._id, status: "processing" }, { $set: { step: "payment-confirmed", status: "opened" } });
                return { confirmed: true as const, type: "buy" as const, cartId: String(cart._id) };
            } catch (error) {
                await databases.cartsBuy.updateOne({ _id: cart._id, status: "processing" }, { $set: { status: "opened" } });
                throw error;
            }
        }
    }
    if (targets.includes("renew")) {
        const cart = await databases.cartsRenew.findOneAndUpdate(
            { paymentId: input.paymentId, status: "opened", step: "waiting-payment", delivered: false },
            { $set: { status: "processing" } }, { new: true },
        );
        if (cart) {
            try {
                const application = await databases.applications.findById(cart.applicationId);
                if (!application) throw new Error("Aplicação da renovação não encontrada.");
                await changeBalance({ action: "add", amount: cart.price, origin: "sales", description: `Renovação paga por ${cart.userId}`, storeId: String(cart.storeId) });
                if (cart.lifetime) application.lifetime = true;
                else if (cart.days) {
                    const base = application.expiresAt && application.expiresAt > new Date() ? application.expiresAt : new Date();
                    application.expiresAt = new Date(base.getTime() + cart.days * 86_400_000);
                }
                application.status = "active";
                await application.save();
                await databases.cartsRenew.updateOne({ _id: cart._id, status: "processing" }, { $set: { step: "payment-confirmed", status: "closed", delivered: true } });
                return { confirmed: true as const, type: "renew" as const, cartId: String(cart._id) };
            } catch (error) {
                await databases.cartsRenew.updateOne({ _id: cart._id, status: "processing" }, { $set: { status: "opened" } });
                throw error;
            }
        }
    }
    const existing = (await Promise.all([
        databases.cartsBuy.findOne({ paymentId: input.paymentId, step: "payment-confirmed" }, { _id: 1 }).lean(),
        databases.cartsRenew.findOne({ paymentId: input.paymentId, step: "payment-confirmed" }, { _id: 1 }).lean(),
    ])).some(Boolean);
    return { confirmed: false as const, alreadyProcessed: existing };
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
        { storeId, currentReleaseVersion: { $exists: true, $ne: null } },
        { storeId: 1, name: 1, prices: 1, messageSettings: 1, currentReleaseVersion: 1 },
    ).lean();
    return products.flatMap((product) => {
        const prices = productPrices(product);
        if (!prices.length) return [];
        return [{
            id: product._id.toString(),
            storeId: product.storeId.toString(),
            name: product.name,
            description: product.messageSettings?.description || null,
            bannerUrl: product.messageSettings?.banner || null,
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

async function validateStoreCheckout(storeId: string) {
    const store = await databases.stores.findById(storeId).lean();
    if (!store) throw new Error("Loja não encontrada. Por favor, contate o administrador do servidor.");
    const owner = await databases.userSettings.findOne({ userId_campos: store.ownerId_campos }).lean();
    if (!owner) throw new Error("Configuração do dono da loja não encontrada. Por favor, contate o administrador do servidor.");

    if (owner.payment_gateway === "efi") {
        const gateway = await efiWrapper.getInstance(owner.userId_discord);
        if (!gateway?.isValid) throw new Error("Não foi possível conectar com o gateway de pagamento. Informe um administrador.");
    } else if (owner.payment_gateway === "manual") {
        if (!owner.manual_payment_credentials?.pix_key || !owner.manual_payment_credentials?.key_type) {
            throw new Error("O dono da loja não configurou as credenciais de pagamento manual. Por favor, contate o administrador do servidor.");
        }
    } else if (owner.payment_gateway === "promisse") {
        if (!owner.promissepay_credentials?.api_key) {
            throw new Error("O dono da loja não configurou as credenciais do PromissePay. Por favor, contate o administrador do servidor.");
        }
        const gateway = await promisseWrapper.getInstance(owner.userId_discord).catch(() => null);
        if (!gateway?.isValid) throw new Error("Não foi possível conectar com o gateway de pagamento. Informe um administrador.");
    } else {
        throw new Error("Gateway de pagamento não configurado. Informe um administrador.");
    }

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
    const { owner } = await validateStoreCheckout(input.storeId);
    const product = await databases.products.findOne({ _id: input.productId, storeId: input.storeId });
    if (!product) throw new Error("Produto não existe mais no banco de dados.");
    if (!product.currentReleaseVersion) throw new Error("Este produto não possui uma versão de release definida. Por favor, contate o administrador do servidor.");
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
        productName: product.name, plan: input.plan, days: selected.days,
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
        productName: product.name, plan, days: cart.days ?? null, lifetime: !!cart.lifetime,
        price: cart.price || 0, status: cart.status, step: cart.step,
        expiresAt: cart.expiresAt.toISOString(),
    };
}
