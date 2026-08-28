import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "ZUROS APP",
        short_name: "ZUROS",
        description: "Gerencie seu bot DROX, loja, pagamentos e automações.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#050505",
        theme_color: "#7c3aed",
        categories: ["business", "utilities", "productivity"],
        icons: [
            { src: "/brand-logo.png", sizes: "any", type: "image/png", purpose: "any" },
            { src: "/brand-logo.png", sizes: "any", type: "image/png", purpose: "maskable" },
        ],
    };
}