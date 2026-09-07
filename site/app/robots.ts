import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
    return { rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/dashboard/app/", "/planos"] }, sitemap: new URL("/sitemap.xml", siteUrl).toString(), host: siteUrl.origin };
}
