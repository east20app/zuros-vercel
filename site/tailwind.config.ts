import type { Config } from "tailwindcss";

const config: Config = {
    content: {
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
                muted: "var(--muted)",
                info: "var(--info)",
                success: "var(--success)",
                warning: "var(--warning)",
                danger: "var(--danger)",
                // Keep zinc mapping for Tailwind utility classes already in use
                zinc: {
                    50: "#f4f5f5",
                    100: "#e4e5e5",
                    200: "#d1d3d3",
                    300: "#b0b4b4",
                    400: "#8d9292",
                    500: "#6e7373",
                    600: "#585c5c",
                    700: "#4a4d4d",
                    800: "#3a3d3d",
                    900: "#2a2d2e",
                    950: "#1a1c1d",
                },
                // Keep discord color namespace for components that reference it
                discord: {
                    bg: "#15191a",
                    sidebar: "#0b0d0e",
                    card: "#1c2223",
                    darker: "#090b0c",
                    border: "rgba(229, 239, 235, 0.12)",
                    muted: "#71807a",
                    text: "#f3f7f4",
                    bright: "#f3f7f4",
                    blurple: "#5b9cff",
                    green: "#57d68a",
                    red: "#ff745a",
                    magenta: "#f2c14e",
                },
                // Map emerald to success tones
                emerald: {
                    400: "#57d68a",
                    500: "#4bc47a",
                    600: "#3fb36d",
                },
                // Map red to danger tones
                red: {
                    400: "#ff745a",
                    500: "#ff5c40",
                    600: "#e64e35",
                },
                // Map blue to info tones
                blue: {
                    400: "#5b9cff",
                    500: "#4a8df0",
                    600: "#3a7de0",
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
