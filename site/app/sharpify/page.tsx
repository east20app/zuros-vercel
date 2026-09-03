import { SharpifyDashboard } from "@/components/SharpifyDashboard";
import { PageHeader } from "@/components/ui";
import { getSharpifyDashboard } from "@/lib/actions/sharpify.actions";
export const dynamic = "force-dynamic";
export default async function SharpifyPage(){const data=await getSharpifyDashboard();return <div className="mx-auto flex max-w-7xl flex-col gap-6"><PageHeader title="Sharpify Gateway" subtitle="Pagamentos, reembolsos, saques e webhooks em um único lugar." /><SharpifyDashboard data={data}/></div>}