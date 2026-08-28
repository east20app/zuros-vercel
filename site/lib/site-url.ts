const DEFAULT_PUBLIC_URL = "https://app.zuros.site";
const configuredUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL;
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

// Metadata routes are evaluated while Next.js collects page data.
// Local builds and some previews do not expose Vercel URL variables yet;
// usar o domínio canônico impede que /robots.txt derrube todo o deploy.
export const siteUrl = new URL(
    configuredUrl
    || (vercelUrl ? `https://${vercelUrl}` : undefined)
    || (process.env.NODE_ENV === "production" ? DEFAULT_PUBLIC_URL : "http://localhost:3000"),
);

export function publicMetadata(title: string, description: string, pathname: string) {
    return {
        title,
        description,
        alternates: { canonical: pathname },
        openGraph: { title, description, url: pathname, siteName: "ZUROS APP", locale: "pt_BR", type: "website" as const, images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ZUROS APP — bots, vendas e hospedagem" }] },
        twitter: { card: "summary_large_image" as const, title, description, images: ["/og-image.png"] },
    };
}
