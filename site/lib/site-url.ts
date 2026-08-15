const configuredUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

if (process.env.NODE_ENV === "production" && !configuredUrl && !vercelUrl) {
    throw new Error("Defina NEXTAUTH_URL, NEXT_PUBLIC_SITE_URL ou VERCEL_URL para gerar URLs públicas em produção.");
}

export const siteUrl = new URL(configuredUrl || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000"));

export function publicMetadata(title: string, description: string, pathname: string) {
    return {
        title,
        description,
        alternates: { canonical: pathname },
        openGraph: { title, description, url: pathname, siteName: "ZUROS APP", locale: "pt_BR", type: "website" as const, images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ZUROS APP — bots, vendas e hospedagem" }] },
        twitter: { card: "summary_large_image" as const, title, description, images: ["/og-image.png"] },
    };
}
