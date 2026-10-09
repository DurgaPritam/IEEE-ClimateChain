"use client";
// Hash chip: truncated value, full value in title, copy button, optional explorer link.
import { useState } from "react";
import { shortHash } from "@/lib/format";
import { useApp } from "@/components/shell/AppState";

export function Hash({ value, label, explorer, kind = "tx" }: {
  value: string; label?: string; explorer?: boolean; kind?: "tx" | "address";
}) {
  const [copied, setCopied] = useState(false);
  const { info } = useApp();
  const full = value.startsWith("0x") ? value : "0x" + value;
  const base = info?.chain.explorer; // e.g. https://amoy.polygonscan.com/tx/
  const href = explorer && base ? base.replace(/\/tx\/$/, `/${kind}/`) + full : null;

  const copy = () => {
    try { navigator.clipboard.writeText(full); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <span title={full} className="inline-flex h-7 items-center overflow-hidden whitespace-nowrap rounded-[6px] border border-line bg-surface-2 font-mono text-[12.5px] text-ink">
      {label && <span className="flex h-full items-center border-r border-line px-2 font-sans text-[11px] uppercase tracking-[0.06em] text-ink-3">{label}</span>}
      <span className="px-[9px] tracking-[0.02em]">{shortHash(full)}</span>
      <button onClick={copy} className="flex h-full items-center gap-1.5 border-l border-line px-[9px] font-sans text-[11px] font-medium text-ink-2 hover:bg-surface hover:text-ink">
        {copied ? <span className="text-pass">✓ Copied</span> : "Copy"}
      </button>
      {href && (
        <a href={href} target="_blank" rel="noopener" className="flex h-full items-center gap-1 border-l border-line px-[9px] font-sans text-[11px] font-medium text-accent no-underline hover:no-underline">
          Explorer ↗
        </a>
      )}
      {explorer && !base && (
        <span className="flex h-full items-center border-l border-line px-[9px] font-sans text-[11px] text-ink-3">offline chain</span>
      )}
    </span>
  );
}
