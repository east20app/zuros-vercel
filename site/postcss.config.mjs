import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('postcss-load-config').Config} */
const config = {
    plugins: {
        tailwindcss: {
            // Caminho absoluto: o Next.js é iniciado pelo manager/bot com cwd na
            // raiz do projeto, então o Tailwind não encontraria o config sozinho.
            config: path.join(__dirname, "tailwind.config.ts"),
        },
    },
};

export default config;
