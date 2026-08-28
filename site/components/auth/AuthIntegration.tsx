"use client";

import { useState } from "react";

interface AuthIntegrationProps {
  licenseId: string;
  authId?: string;
  integrationKey?: string;
}

export default function AuthIntegration({
  licenseId,
  authId,
  integrationKey,
}: AuthIntegrationProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const envConfig = `# Add to your bot's .env file
AUTH_LICENSE_ID=${licenseId}
${authId ? `AUTH_ID=${authId}` : "# AUTH_ID=<will be set after creation>"}
${integrationKey ? `AUTH_INTEGRATION_KEY=${integrationKey}` : "# AUTH_INTEGRATION_KEY=<will be set after key rotation>"}`;

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-5">
      <h2 className="text-lg font-semibold text-white">Integration</h2>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-4">
          <div>
            <p className="text-xs text-zinc-400 mb-1">Auth ID</p>
            <p className="text-sm font-mono text-white">{authId || "Not configured"}</p>
          </div>
          {authId && (
            <button
              onClick={() => copyToClipboard(authId, "authId")}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
            >
              {copiedField === "authId" ? "Copied!" : "Copy"}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-4">
          <div>
            <p className="text-xs text-zinc-400 mb-1">License ID</p>
            <p className="text-sm font-mono text-white">{licenseId}</p>
          </div>
          <button
            onClick={() => copyToClipboard(licenseId, "licenseId")}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
          >
            {copiedField === "licenseId" ? "Copied!" : "Copy"}
          </button>
        </div>

        {integrationKey && (
          <div className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.02] p-4">
            <div>
              <p className="text-xs text-zinc-400 mb-1">Integration Key</p>
              <p className="text-sm font-mono text-white truncate max-w-xs">
                {integrationKey.slice(0, 8)}...{integrationKey.slice(-4)}
              </p>
            </div>
            <button
              onClick={() => copyToClipboard(integrationKey, "integrationKey")}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
            >
              {copiedField === "integrationKey" ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Bot Configuration</h3>
          <button
            onClick={() => copyToClipboard(envConfig, "env")}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
          >
            {copiedField === "env" ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="rounded-xl border border-white/[.07] bg-black/60 p-4 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
          {envConfig}
        </pre>
      </div>
    </div>
  );
}
