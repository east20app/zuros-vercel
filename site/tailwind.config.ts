import type { Config } from "tailwindcss";

/**
 * Tema escuro Zuros Apps:
 *   - Fundo base navy #0a0e27 (a escala zinc é remapeada para tons de navy
 *     com a mesma função de contraste, re-tematizando toda a interface)
 *   - Primário Blurple #5865F2 (Discord)
 *   - Destaque magenta #EB459E
 *   - Tipografia: Poppins (títulos) + Inter (corpo)
 */
const navyGrays = {
    50: "#eef2fb",
    100: "#dce4f6",
    200: "#bcc8ea",
    300: "#93a4d9",
    400: "#6d80c2",
    500: "#4d5faa",
    600: "#3a4a8f",
    700: "#2c3975",
    800: "#1e2859",
    900: "#141c41",
    950: "#0b1130",
};
const discordGreen = {
    50: "#ebf9ef",
    100: "#d2f2dc",
    200: "#a8e7bd",
    300: "#74d393",
    400: "#47bd6e",
    500: "#23a559",
    600: "#1e8b4d",
    700: "#197040",
    800: "#145533",
    900: "#0e3a24",
    950: "#072918",
};
const discordRed = {
    50: "#fdecec",
    100: "#fbcfd0",
    200: "#f7a0a2",
    300: "#f47073",
    400: "#f25357",
    500: "#f23f43",
    600: "#d93135",
    700: "#b12428",
    800: "#8a1a1e",
    900: "#631214",
    950: "#3d0a0c",
};
const discordBlurple = {
    50: "#eef0fd",
    100: "#d8dcfb",
    200: "#b1b9f6",
    300: "#8a95f1",
    400: "#6f7cf5",
    500: "#7c3aed",
    600: "#6d28d9",
    700: "#3840a1",
    800: "#2a2f7d",
    900: "#1d2158",
    950: "#121437",
};
const magentaPink = {
    50: "#fdeef6",
    100: "#fbd8ec",
    200: "#f8b2d9",
    300: "#f487c1",
    400: "#f05fae",
    500: "#eb459e",
    600: "#cf2f87",
    700: "#ab2470",
    800: "#861c59",
    900: "#5f1240",
    950: "#380a25",
};

const config: Config = {
    content: {
        // Resolve os globs a partir do diretório deste arquivo (site/), e não
        // do cwd do processo, porque o Next.js roda com cwd na raiz do projeto.
        relative: true,
        files: [
            "./app/**/*.{js,ts,jsx,tsx,mdx}",
            "./components/**/*.{js,ts,jsx,tsx,mdx}",
            "./lib/**/*.{js,ts,jsx,tsx,mdx}",
        ],
    },
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                "background-dark": "var(--background-dark)",
                foreground: "var(--foreground)",
                surface: "var(--surface)",
                "surface-raised": "var(--surface-raised)",
                accent: "var(--accent)",
                magenta: magentaPink,
                zinc: navyGrays,
                emerald: discordGreen,
                red: discordRed,
                blue: discordBlurple,
                discord: {
                    bg: "#141c41",
                    sidebar: "#0b1130",
                    card: "#101738",
                    darker: "#0a0e27",
                    border: "#2c3975",
                    muted: "#7e8bbd",
                    text: "#dce4f6",
                    bright: "#eef2fb",
                    blurple: "#7c3aed",
                    green: "#23a559",
                    red: "#f23f43",
                    magenta: "#eb459e",
                },
            },
            fontFamily: {
                sans: [
                    "Inter",
                    "ui-sans-serif",
                    "system-ui",
                    "-apple-system",
                    "Segoe UI",
                    "Helvetica Neue",
                    "Arial",
                    "sans-serif",
                ],
                display: [
                    "Poppins",
                    "Inter",
                    "ui-sans-serif",
                    "system-ui",
                    "-apple-system",
                    "Segoe UI",
                    "Helvetica Neue",
                    "Arial",
                    "sans-serif",
                ],
                discord: [
                    "Inter",
                    "ui-sans-serif",
                    "system-ui",
                    "-apple-system",
                    "Segoe UI",
                    "Helvetica Neue",
                    "Arial",
                    "sans-serif",
                ],
            },
        },
    },
    plugins: [],
};

export default config;
