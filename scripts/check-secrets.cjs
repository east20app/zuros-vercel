const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function trackedFiles() {
    try {
        return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    } catch {
        return [];
    }
}

const files = trackedFiles();
const findings = [];
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".zip", ".pdf", ".woff", ".woff2"]);
const patterns = [
    ["Vercel token", /\bvcp_[A-Za-z0-9_-]{30,}\b/g],
    ["Discord bot token", /\b(?:MTA|MTI|MTM|MTQ|MTU|MTY|MTc|MTg|MTk)[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g],
    ["CamposCloud API key", /\b[0-9a-f]{24}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
    ["MongoDB URI with credentials", /\bmongodb(?:\+srv)?:\/\/[^:\s/]+:[^@\s/]+@/gi],
    ["Sharpify client secret", /\bSHARPIFY_CLIENT_SECRET_[A-Za-z0-9_-]{12,}\b/g],
];

for (const relative of files) {
    const normalized = relative.replace(/\\/g, "/");
    const basename = path.basename(normalized);
    if (/^\.env(?:\.|$)/.test(basename) && basename !== ".env.example") {
        findings.push(normalized + ": tracked environment file");
        continue;
    }
    if (binaryExtensions.has(path.extname(normalized).toLowerCase())) continue;
    const absolute = path.join(process.cwd(), relative);
    if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 2000000) continue;
    const source = fs.readFileSync(absolute, "utf8");
    for (const [label, pattern] of patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(source)) findings.push(normalized + ": " + label);
    }
}

if (findings.length) {
    console.error("Potential secrets found in tracked files:");
    for (const finding of findings) console.error("- " + finding);
    process.exit(1);
}
console.log("Secret scan passed: no known secret pattern in tracked files.");