import { redirect } from "next/navigation";

export default function LegacyAccountInvoicesPage() {
    redirect("/dashboard/invoices");
}
