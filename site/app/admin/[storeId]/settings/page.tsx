import { StoreAdministration } from "@/components/StoreAdministration";
import { getStoreAdministration } from "@/lib/actions/admin.actions";

export const dynamic = "force-dynamic";
export default async function StoreSettingsPage({ params }: { params: Promise<{ storeId: string }> }) { const resolvedParams = await params;
    return <StoreAdministration store={await getStoreAdministration(resolvedParams.storeId)} />;
}
