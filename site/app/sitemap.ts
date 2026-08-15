import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
    return ["", "/planos", "/login", "/privacidade", "/termos"].map((route, index) => ({ url: new URL(route || "/", siteUrl).toString(), lastModified: new Date(), changeFrequency: index < 2 ? "weekly" as const : "monthly" as const, priority: index === 0 ? 1 : index === 1 ? 0.9 : 0.5 }));
}
