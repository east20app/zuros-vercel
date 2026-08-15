import { CouponManager } from "@/components/CouponManager";
import { getStoreProducts, listCoupons } from "@/lib/actions/admin.actions";

export const dynamic = "force-dynamic";

export default async function StoreCouponsPage({ params }: { params: { storeId: string } }) {
    const [coupons, products] = await Promise.all([
        listCoupons(params.storeId),
        getStoreProducts(params.storeId),
    ]);

    return <CouponManager storeId={params.storeId} coupons={coupons} products={products} />;
}
