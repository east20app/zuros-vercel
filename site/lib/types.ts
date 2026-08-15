export type AppStatus = "active" | "grace_period";
export type PaymentGateway = "efi" | "manual" | "promisse";
export type CartStep = "select-days" | "select-coupons" | "waiting-payment" | "payment-confirmed";

export interface AppSummary {
    id: string;
    name: string;
    status: AppStatus;
    lifetime: boolean;
    expiresAt: string | null;
    version: string;
    errorOnUpdate: boolean;
    productName: string;
    storeId: string;
    storeName: string;
    ownerId?: string;
    botId?: string;
}

export interface AppDetail {
    id: string;
    storeId: string;
    name: string;
    botId: string;
    token: string;
    status: AppStatus;
    lifetime: boolean;
    expiresAt: string | null;
    version: string;
    errorOnUpdate: boolean;
    errorOnUpdateMessage: string;
    productId: string;
    productName: string;
    appId: string | null;
    online: boolean;
    memoryMB: number | null;
    memoryUsedMB: number | null;
    uptime: number | null;
    needsUpdate: boolean;
}

export interface RenewPrices {
    weekly?: number;
    biweekly?: number;
    monthly?: number;
    lifetime?: number;
}

export interface ExtractEntry {
    id: string;
    price: number;
    finalPrice: number;
    days: number | null;
    lifetime: boolean;
    createdAt: string | null;
}

export interface CartRenewView {
    id: string;
    userId: string;
    appId: string;
    appName: string;
    storeId: string;
    price: number;
    finalPrice: number;
    days: number | null;
    lifetime: boolean;
    couponCode: string | null;
    status: string;
    step: CartStep;
    paymentId: string | null;
    expiresAt: string | null;
    createdAt: string | null;
}

export interface CartBuyView {
    id: string;
    channelId: string;
    userId: string;
    guildId: string;
    storeId: string;
    productId: string;
    productName: string;
    price: number;
    finalPrice: number;
    automaticPayment: boolean;
    status: string;
    step: CartStep;
    paymentId: string | null;
    expiresAt: string | null;
    createdAt: string | null;
}

export interface ProductView {
    id: string;
    storeId: string;
    storeName: string;
    name: string;
    runtimeEnvironment: string;
    runCommand: string;
    needToUpdateApplications: boolean;
    prices: {
        weekly?: number;
        biweekly?: number;
        monthly?: number;
        lifetime?: number;
    };
    currentReleaseVersion: string | null;
    lastReleaseCreatedVersion: string;
    protectedFiles: string[];
    redeemSettings: { active: boolean; days?: number; webhook?: string };
    memoryMB: number;
    messageSettings: { description: string; banner: string; video: string; buttonName: string };
    applicationsCount: number;
    pendingUpdateApplications: number;
    errorOnUpdateApplications: number;
    releases: {
        id: string;
        version: string;
        date: string;
        isCurrent: boolean;
    }[];
}

export interface CouponView {
    id: string;
    storeId: string;
    storeName: string;
    code: string;
    discount: number;
    remainingUses: number;
    expiresAt: string;
    roles: string[];
    products: string[];
    applicableProductNames: string;
    valid: boolean;
}

export interface StoreView {
    id: string;
    name: string;
    balance: number;
    applicationsCount: number;
    productsCount: number;
    couponsCount: number;
}

export interface ExtractView {
    id: string;
    storeId: string;
    storeName: string;
    origin: "sales" | "manual";
    action: "add" | "remove";
    description: string | null;
    amount: number;
    createdAt: string;
}

export interface SettingsView {
    userLinked: boolean;
    tokenCamposMasked: string | null;
    tokenCamposConfigured: boolean;
    paymentGateway: PaymentGateway | null;
    efiConfigured: boolean;
    efiValid: boolean;
    manualConfigured: boolean;
    promisseConfigured: boolean;
    promisseValid: boolean;
    stores: StoreView[];
}
