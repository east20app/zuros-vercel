import { z } from "zod";

export const purchasePlanSchema = z.enum(["weekly", "biweekly", "monthly", "lifetime"]);
export type PurchasePlan = z.infer<typeof purchasePlanSchema>;
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Identificador inválido.");
export const releaseUploadSchema = z.object({ storeId: objectIdSchema, productId: objectIdSchema });
export const productMessageSchema = z.object({
    description: z.string().trim().max(4000).default(""),
    banner: z.string().trim().url("URL do banner inválida.").or(z.literal("")).default(""),
    video: z.string().trim().url("URL do vídeo inválida.").or(z.literal("")).default(""),
    buttonName: z.string().trim().min(1).max(80).default("Comprar"),
});
export type ProductMessageDTO = z.infer<typeof productMessageSchema>;

export interface PurchasePriceDTO {
    plan: PurchasePlan;
    days: number | null;
    label: string;
    price: number;
}

export interface StoreCatalogDTO {
    id: string;
    name: string;
    products: ProductCatalogDTO[];
}

export interface ProductCatalogDTO {
    id: string;
    storeId: string;
    name: string;
    productType: "bot" | "auth" | "complete";
    description: string | null;
    bannerUrl: string | null;
    available: boolean;
    prices: PurchasePriceDTO[];
}

export interface PurchaseCartDTO {
    id: string;
    storeId: string;
    productId: string;
    productName: string;
    productType: "bot" | "auth" | "complete";
    plan: PurchasePlan;
    days: number | null;
    lifetime: boolean;
    price: number;
    status: string;
    step: string;
    expiresAt: string;
}
