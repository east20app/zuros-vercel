import type { Model } from "mongoose";
import databases from "../databases";
import { applyDiscountCents, toCents } from "./money";

type CartType = "buy" | "renew";

function cartModel(cartType: CartType): Model<any> {
    return (cartType === "buy" ? databases.cartsBuy : databases.cartsRenew) as Model<any>;
}

export async function reserveCouponForCart(input: { cartType: CartType; cartId: string; userId: string; code: string; productId: string }) {
    const code = input.code.trim().toUpperCase();
    if (!code) throw new Error("Digite o código do cupom.");
    const model = cartModel(input.cartType);
    const cart = await model.findOne({ _id: input.cartId, userId: input.userId, status: "opened", step: "select-coupons" }).lean() as any;
    if (!cart) throw new Error("Este carrinho não aceita mais cupons.");
    if (cart.coupon || cart.couponReservationState) throw new Error("Este carrinho já possui um cupom reservado.");
    const coupon = await databases.coupons.findOne({ code, storeId: cart.storeId, remainingUses: { $gt: 0 }, expiresAt: { $gt: new Date() } }).lean();
    if (!coupon) throw new Error("Cupom inválido, expirado ou sem usos disponíveis.");
    if (coupon.roles?.length) throw new Error("Este cupom é exclusivo para cargos do servidor.");
    if (coupon.products?.length && !coupon.products.includes("all") && !coupon.products.includes(input.productId)) throw new Error("Este cupom não é válido para este produto.");
    const grossCents = toCents(Number(cart.price || 0));
    const netCents = applyDiscountCents(grossCents, coupon.discount);
    const reserved = await model.updateOne(
        { _id: cart._id, coupon: { $exists: false }, couponReservationState: { $exists: false }, status: "opened", step: "select-coupons" },
        { $set: { coupon: coupon._id, couponCodeSnapshot: code, couponDiscountSnapshot: coupon.discount, grossPriceCents: grossCents, discountCents: grossCents - netCents, couponReservationState: "reserved" } },
    );
    if (!reserved.modifiedCount) throw new Error("Outro cupom já foi aplicado a este carrinho.");
    const decremented = await databases.coupons.updateOne({ _id: coupon._id, remainingUses: { $gt: 0 } }, { $inc: { remainingUses: -1 } });
    if (!decremented.modifiedCount) {
        await model.updateOne({ _id: cart._id, couponReservationState: "reserved", coupon: coupon._id }, { $unset: { coupon: 1, couponCodeSnapshot: 1, couponDiscountSnapshot: 1, grossPriceCents: 1, discountCents: 1, couponReservationState: 1 } });
        throw new Error("Este cupom não possui mais usos disponíveis.");
    }
    return { discount: coupon.discount, code, discountCents: grossCents - netCents };
}

export async function releaseCouponReservation(input: { cartType: CartType; cartId: string }) {
    const model = cartModel(input.cartType);
    const cart = await model.findOneAndUpdate({ _id: input.cartId, couponReservationState: "reserved" }, { $set: { couponReservationState: "released" } }, { new: false }).lean() as any;
    if (!cart?.coupon) return { released: false as const };
    await databases.coupons.updateOne({ _id: cart.coupon }, { $inc: { remainingUses: 1 } });
    return { released: true as const };
}
