import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { requireUser } from "@/lib/require-admin";
import { listAdminStores } from "@/lib/actions/admin.actions";

export default async function StoreLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: { storeId: string };
}) {
    await requireUser();

    const stores = await listAdminStores();
    const store = stores.find((s) => s.id === params.storeId);
    if (!store) notFound();

    return (
        <div className="flex flex-col gap-6">
            <AdminNav stores={stores} storeId={params.storeId} />
            {children}
        </div>
    );
}
