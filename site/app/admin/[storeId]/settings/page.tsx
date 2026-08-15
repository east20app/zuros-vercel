import { StoreAdministration } from "@/components/StoreAdministration";
import { getStoreAdministration } from "@/lib/actions/admin.actions";

export const dynamic = "force-dynamic";
export default async function StoreSettingsPage({ params }: { params: { storeId: string } }) {
    return <StoreAdministration store={await getStoreAdministration(params.storeId)} />;
}
