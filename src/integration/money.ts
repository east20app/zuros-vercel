export const MONEY_SCALE = 100;

export function toCents(value: number | string): number {
    const normalized = typeof value === "string" ? Number(value.replace(",", ".")) : value;
    if (!Number.isFinite(normalized) || normalized < 0) throw new Error("Valor monetário inválido.");
    const cents = Math.round((normalized + Number.EPSILON) * MONEY_SCALE);
    if (!Number.isSafeInteger(cents)) throw new Error("Valor monetário fora do limite seguro.");
    return cents;
}

export function fromCents(cents: number): number {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Valor em centavos inválido.");
    return cents / MONEY_SCALE;
}

export function applyDiscountCents(grossCents: number, discountPercent = 0): number {
    if (!Number.isSafeInteger(grossCents) || grossCents < 0) throw new Error("Preço inválido.");
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        throw new Error("Desconto inválido.");
    }
    return Math.round(grossCents * (10_000 - Math.round(discountPercent * 100)) / 10_000);
}

export function addPercentageFeeCents(netCents: number, feePercent: number): number {
    if (!Number.isSafeInteger(netCents) || netCents < 0) throw new Error("Preço líquido inválido.");
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent >= 100) throw new Error("Taxa inválida.");
    return Math.round(netCents / (1 - feePercent / 100));
}

export function calculateCheckoutCents(price: number | string, discountPercent = 0, feePercent = 0) {
    const grossCents = toCents(price);
    const netCents = applyDiscountCents(grossCents, discountPercent);
    const chargedCents = feePercent ? addPercentageFeeCents(netCents, feePercent) : netCents;
    return { grossCents, discountCents: grossCents - netCents, netCents, chargedCents };
}
