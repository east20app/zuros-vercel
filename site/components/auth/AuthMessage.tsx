"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchAuthMessage, saveAuthMessage } from "@/lib/actions/auth.actions";

interface AuthMessageProps {
  licenseId: string;
}

interface EmbedConfig {
  title: string;
  description: string;
  color: string;
  image_url: string;
  thumbnail_url: string;
  footer_text: string;
}

interface ButtonConfig {
  label: string;
  emoji: string;
  style: string;
}

interface MessageConfig {
  content: string;
  embed: EmbedConfig;
  button: ButtonConfig;
  enabled: boolean;
}

const defaultMessage: MessageConfig = {
  content: "",
  embed: {
    title: "",
    description: "",
    color: "#5865F2",
    image_url: "",
    thumbnail_url: "",
    footer_text: "",
  },
  button: {
    label: "Verify",
    emoji: "✅",
    style: "PRIMARY",
  },
  enabled: false,
};

export default function AuthMessage({ licenseId }: AuthMessageProps) {
  const [message, setMessage] = useState<MessageConfig>(defaultMessage);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      try {
        const r = await fetchAuthMessage(licenseId);
        if (r.ok) {
          setMessage(r.data as unknown as MessageConfig);
          setError(null);
        } else {
          setError(r.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Falha ao carregar mensagem.");
      }
    });
  }, [licenseId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const r = await saveAuthMessage(licenseId, {
        content: message.content,
        embed: message.embed as unknown as Record<string, unknown>,
        button_label: message.button.label,
        button_emoji: message.button.emoji,
        button_style: message.button.style,
        enabled: message.enabled,
      });
      if (r.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(r.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar mensagem.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateEmbed = (field: keyof EmbedConfig, value: string) => {
    setMessage((prev) => ({
      ...prev,
      embed: { ...prev.embed, [field]: value },
    }));
  };

  const updateButton = (field: keyof ButtonConfig, value: string) => {
    setMessage((prev) => ({
      ...prev,
      button: { ...prev.button, [field]: value },
    }));
  };

  return (
    <div className="rounded-2xl border border-white/[.07] bg-[#08090b] p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Auth Message</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={message.enabled}
            onChange={(e) =>
              setMessage((prev) => ({ ...prev, enabled: e.target.checked }))
            }
            className="sr-only peer"
          />
          <div className="relative h-5 w-9 rounded-full bg-zinc-700 peer-checked:bg-violet-600 transition-colors">
            <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </div>
          <span className="text-xs text-zinc-400">Enabled</span>
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 text-sm">
          Message saved successfully
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Content</label>
        <textarea
          value={message.content}
          onChange={(e) =>
            setMessage((prev) => ({ ...prev, content: e.target.value }))
          }
          rows={3}
          placeholder="Message content..."
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500 resize-none"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Embed</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Title</label>
            <input
              type="text"
              value={message.embed.title}
              onChange={(e) => updateEmbed("title", e.target.value)}
              placeholder="Embed title"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Color</label>
            <input
              type="color"
              value={message.embed.color}
              onChange={(e) => updateEmbed("color", e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/40 cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400">Description</label>
          <textarea
            value={message.embed.description}
            onChange={(e) => updateEmbed("description", e.target.value)}
            rows={3}
            placeholder="Embed description"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500 resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Image URL</label>
            <input
              type="text"
              value={message.embed.image_url}
              onChange={(e) => updateEmbed("image_url", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Thumbnail URL</label>
            <input
              type="text"
              value={message.embed.thumbnail_url}
              onChange={(e) => updateEmbed("thumbnail_url", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400">Footer Text</label>
          <input
            type="text"
            value={message.embed.footer_text}
            onChange={(e) => updateEmbed("footer_text", e.target.value)}
            placeholder="Footer text"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Button</h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Label</label>
            <input
              type="text"
              value={message.button.label}
              onChange={(e) => updateButton("label", e.target.value)}
              placeholder="Verify"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Emoji</label>
            <input
              type="text"
              value={message.button.emoji}
              onChange={(e) => updateButton("emoji", e.target.value)}
              placeholder="✅"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Style</label>
            <select
              value={message.button.style}
              onChange={(e) => updateButton("style", e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            >
              <option value="PRIMARY">Primary</option>
              <option value="SECONDARY">Secondary</option>
              <option value="SUCCESS">Success</option>
              <option value="DANGER">Danger</option>
              <option value="LINK">Link</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Save Message"}
        </button>
      </div>
    </div>
  );
}
