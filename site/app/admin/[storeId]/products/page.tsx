import { ProductManager } from "@/components/ProductManager";
import { getStoreProducts } from "@/lib/actions/admin.actions";

export const dynamic = "force-dynamic";

export default async function StoreProductsPage({ params }: { params: Promise<{ storeId: string }> }) { const resolvedParams = await params;
    const products = await getStoreProducts(resolvedParams.storeId);
    return <ProductManager storeId={resolvedParams.storeId} products={products} />;
}
