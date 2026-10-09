// Status pill — four channels per state (color, glyph, fill style, label), readable in grayscale.
import type { Status } from "@/lib/types";

const LABELS: Record<Status, string> = {
  pass: "Pass", warn: "Needs review", block: "Blocked",
  signed: "Signed", anchored: "Anchored · pending", verified: "Verified · co-signed",
};

const base = "inline-flex w-max h-6 items-center gap-[7px] whitespace-nowrap text-[12px] leading-none";

export function Pill({ status, label }: { status: Status; label?: string }) {
  const text = label ?? LABELS[status];
  switch (status) {
    case "pass":
      return (
        <span className={`${base} rounded-full bg-pass-bg pl-1.5 pr-2.5 font-medium text-pass`}>
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-current text-[8px] font-bold">✓</span>
          {text}
        </span>
      );
    case "warn":
      return (
        <span className={`${base} rounded-full bg-warn-bg pl-[7px] pr-2.5 font-medium text-warn`}>
          <span className="text-[11px]">▲</span>{text}
        </span>
      );
    case "block":
      return (
        <span className={`${base} rounded-sm bg-block pl-1.5 pr-2.5 font-semibold text-on-status`}>
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[2px] bg-on-status text-[9px] font-bold text-block">✕</span>
          {text}
        </span>
      );
    case "signed":
      return (
        <span className={`${base} rounded-full border border-signed pl-2 pr-2.5 font-medium text-signed`}>
          <span className="text-[10px]">◆</span>{text}
        </span>
      );
    case "anchored":
      return (
        <span className={`${base} rounded-full border border-dashed border-anchored bg-anchored-bg pl-[7px] pr-2.5 font-medium text-anchored`}>
          <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-dashed border-current" />{text}
        </span>
      );
    case "verified":
      return (
        <span className={`${base} gap-1.5 rounded-full bg-verified pl-2 pr-2.5 font-semibold text-on-status`}>
          <span className="text-[10px] font-bold tracking-[-2px]">✓✓</span><span className="ml-0.5">{text}</span>
        </span>
      );
  }
}

export const reportStatusPill = (s: string): Status =>
  ({ blocked: "block", flagged: "warn", ready: "pass", plant_signed: "anchored", verified: "verified" } as const)[
    s as "blocked" | "flagged" | "ready" | "plant_signed" | "verified"
  ] ?? "pass";
