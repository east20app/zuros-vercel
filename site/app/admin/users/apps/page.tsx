import { redirect } from "next/navigation";
import { listAdminStores } from "@/lib/actions/admin.actions";

export const dynamic = "force-dynamic";

export default async function AdminUserAppsPage() {
    const stores = await listAdminStores();
    const store = stores[0];

    redirect(store ? `/admin/${store.id}/apps` : "/admin");
}
