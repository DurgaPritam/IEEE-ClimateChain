// Small layout primitives shared by every screen (from the VERDANT-X design system).
import type { ReactNode } from "react";

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto box-border w-full max-w-[1360px] px-4 pb-10 pt-7 sm:px-10 ${className}`}>{children}</main>;
}

export function PageHeader({ kicker, title, right }: { kicker: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <span className="vx-label">{kicker}</span>
        <h1 className="m-0 text-h1">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-2.5 text-small text-ink-2">{right}</div>}
    </div>
  );
}

export function Card({ title, aside, children, className = "", padded = true }: {
  title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={`vx-card ${padded ? "flex flex-col gap-4 px-6 py-[22px]" : "overflow-hidden"} ${className}`}>
      {(title || aside) && (
        <div className={`flex flex-wrap items-baseline justify-between gap-3 ${padded ? "" : "px-[22px] pb-3.5 pt-5"}`}>
          {title && <span className="text-h3">{title}</span>}
          {aside && <span className="text-[12px] text-ink-3">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, unit, hint, invalid, children }: {
  label: ReactNode; unit?: string; hint?: ReactNode; invalid?: boolean; children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-small text-ink-2">{label}</span>
      <span className={`flex h-10 items-center rounded-[7px] border bg-bg ${invalid ? "border-block" : "border-line"}`}>
        {children}
        {unit && <span className="flex h-full items-center border-l border-line-soft px-3 font-mono text-[12px] text-ink-3">{unit}</span>}
      </span>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputCls = "h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-[15px] tabular-nums text-ink outline-none";

export function NumberInput({ value, onChange, step = "any" }: {
  value: number | null; onChange: (v: number | null) => void; step?: string;
}) {
  return (
    <input
      type="number" step={step} className={inputCls}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex w-max max-w-full flex-wrap gap-0.5 rounded-lg border border-line bg-bg p-[3px]">
      {options.map((o) => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)}
          className={o.value === value
            ? "rounded-[6px] bg-surface-2 px-3.5 py-2 text-[13px] font-medium leading-none shadow-[inset_0_0_0_1px_var(--vx-accent)]"
            : "rounded-[6px] px-3.5 py-2 text-[13px] leading-none text-ink-3 hover:text-ink"}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, unit, sub, tone }: {
  label: ReactNode; value: ReactNode; unit?: string; sub?: ReactNode; tone?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className="text-[44px] font-light leading-none tracking-[-0.02em]" style={tone ? { color: tone } : undefined}>
        {value} {unit && <span className="text-[18px] tracking-normal text-ink-3">{unit}</span>}
      </span>
      {sub && <span className="text-[12px] text-ink-3">{sub}</span>}
    </div>
  );
}

export function Banner({ tone, title, children }: { tone: "pass" | "warn" | "block"; title?: ReactNode; children?: ReactNode }) {
  if (tone === "block") {
    return (
      <div className="flex gap-[18px] rounded-[10px] border-[1.5px] border-block bg-block-bg px-6 py-[22px]">
        <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-sm bg-block text-[17px] font-bold text-on-status">✕</span>
        <div className="flex flex-col gap-2">
          {title && <span className="text-[12px] font-semibold uppercase leading-none tracking-[0.09em] text-block">{title}</span>}
          {children}
        </div>
      </div>
    );
  }
  const pass = tone === "pass";
  return (
    <div className={`flex items-center gap-3.5 rounded-lg border px-[18px] py-3.5 ${pass ? "border-pass bg-pass-bg" : "border-warn bg-warn-bg"}`}>
      {pass
        ? <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-[1.5px] border-pass text-[11px] font-bold text-pass">✓</span>
        : <span className="flex-none text-[18px] text-warn">▲</span>}
      <span className="text-body">{title}{children}</span>
    </div>
  );
}

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="vx-card flex flex-col items-start gap-3 border-dashed px-6 py-10">
      <span className="text-h2">{title}</span>
      {children && <div className="text-small text-ink-2">{children}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return <div className="rounded-lg border border-block bg-block-bg px-4 py-3 text-small text-ink">{msg}</div>;
}
