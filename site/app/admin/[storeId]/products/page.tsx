import { ProductManager } from "@/components/ProductManager";
import { getStoreProducts } from "@/lib/actions/admin.actions";

export const dynamic = "force-dynamic";

export default async function StoreProductsPage({ params }: { params: { storeId: string } }) {
    const products = await getStoreProducts(params.storeId);
    return <ProductManager storeId={params.storeId} products={products} />;
}
