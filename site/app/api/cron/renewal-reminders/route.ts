import { NextResponse } from "next/server";
import databases from "@root/src/databases";
import { sendRenewalReminder } from "@root/src/functions/transactional-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const expected = process.env.CRON_SECRET?.trim();
    const authorization = request.headers.get("authorization") || "";
    if (!expected || authorization !== `Bearer ${expected}`) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 86_400_000);
    const applications = await databases.applications.find({ lifetime: false, status: "active", expiresAt: { $gt: now, $lte: horizon } }).select("name ownerId expiresAt renewalReminder7SentAt renewalReminder1SentAt").limit(500).lean();
    let sent = 0;
    for (const application of applications) {
        if (!application.expiresAt) continue;
        const daysLeft = Math.max(1, Math.ceil((new Date(application.expiresAt).getTime() - now.getTime()) / 86_400_000));
        const tier = daysLeft <= 1 ? 1 : 7;
        const alreadySent = tier === 1 ? application.renewalReminder1SentAt : application.renewalReminder7SentAt;
        if (alreadySent) continue;
        try {
            await sendRenewalReminder({ userId: application.ownerId, applicationName: application.name, expiresAt: new Date(application.expiresAt), daysLeft: tier });
            await databases.applications.updateOne({ _id: application._id, ...(tier === 1 ? { renewalReminder1SentAt: { $exists: false } } : { renewalReminder7SentAt: { $exists: false } }) }, { $set: tier === 1 ? { renewalReminder1SentAt: now } : { renewalReminder7SentAt: now } });
            sent += 1;
        } catch (error) {
            console.error("[cron:renewal-reminders] Falha:", application._id, error instanceof Error ? error.message : "erro desconhecido");
        }
    }
    return NextResponse.json({ ok: true, scanned: applications.length, sent });
}
