import { CouponManager } from "@/components/CouponManager";
import { getStoreProducts, listCoupons } from "@/lib/actions/admin.actions";

export const dynamic = "force-dynamic";

export default async function StoreCouponsPage({ params }: { params: Promise<{ storeId: string }> }) { const resolvedParams = await params;
    const [coupons, products] = await Promise.all([
        listCoupons(resolvedParams.storeId),
        getStoreProducts(resolvedParams.storeId),
    ]);

    return <CouponManager storeId={resolvedParams.storeId} coupons={coupons} products={products} />;
}
