import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// As variáveis de ambiente são carregadas pelo processo principal (bot) antes
// de iniciar o Next.js. No build, use scripts/build-site.cjs para injetar o
// .env.production/.env da raiz. Não importar "dotenv" aqui: o resolver ESM do
// host (tsx) não encontra o entry point em alguns layouts de deploy.

/** @type {import('next').NextConfig} */
const nextConfig = {
    outputFileTracingRoot: path.join(__dirname, '..'),
    serverExternalPackages: ['mongoose', 'mongodb', '@camposcloud/sdk'],
    // O pipeline executa estas verificações antes do build. Evita que o Next
    // abra workers extras de lint/TypeScript, que são instáveis no Windows.
    async rewrites() {
        return [{ source: "/favicon.ico", destination: "/icon.svg" }];
    },
    // Não deixa o modo dev sobrescrever o build usado em produção.
    distDir: process.env.NEXT_DIST_DIR
        || (process.env.VERCEL ? ".next" : process.env.NODE_ENV === "development" ? ".next-dev" : "next-build-visual"),
    async headers() {
        return [
            ...(process.env.NODE_ENV === "production" ? [{
                source: "/_next/static/:path*",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            }] : []),
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "X-Frame-Options",
                        value: "DENY",
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin",
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=(), payment=()",
                    },
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: blob: https:",
                            "font-src 'self' data:",
                            "connect-src 'self' https: wss:",
                            "frame-ancestors 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                        ].join("; "),
                    },
                ],
            },
        ];
    },
    experimental: {
        cpus: 1,
        // Mantém o mongoose/driver fora do bundle webpack: bundlar minifica e
        // quebra os tipos de schema (ex.: "Invalid schema configuration").
    },
    webpack: (config, { isServer, dev }) => {
        // The panel runs inside the tsx-based bot process. Webpack's persistent
        // development cache can retain runtime manifests without their vendor
        // chunks after Fast Refresh. Rebuild in memory in dev; production keeps
        // its normal filesystem cache and optimized output.
        if (dev) config.cache = false;

        if (isServer) {
            // Garante que o mongoose não seja bundlado nem minificado (fallback
            // caso serverExternalPackages não seja respeitado).
            const externals = Array.isArray(config.externals) ? config.externals : [];
            externals.push({
                mongoose: "commonjs mongoose",
                mongodb: "commonjs mongodb",
                "@camposcloud/sdk": "commonjs @camposcloud/sdk",
            });
            config.externals = externals;
        }

        // O driver do MongoDB possui dependências opcionais nativas que não são
        // instaladas; o webpack tenta resolvê-las e falha. Desativamos essas
        // resoluções: em runtime o driver as ignora dentro de try/catch.
        config.resolve.fallback = {
            ...config.resolve.fallback,
            aws4: false,
            kerberos: false,
            snappy: false,
            "mongodb-client-encryption": false,
            "@mongodb-js/zstd": false,
            saslprep: false,
            "zlib-sync": false,
            bufferutil: false,
            "utf-8-validate": false,
        };
        return config;
    },
};

export default nextConfig;
