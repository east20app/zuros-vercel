import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "ZUROS APP",
        short_name: "ZUROS",
        description: "Gerencie seu Zuros Bot, loja, pagamentos e automações.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#050505",
        theme_color: "#f5a623",
        categories: ["business", "utilities", "productivity"],
        icons: [
            { src: "/brand/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/brand/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
