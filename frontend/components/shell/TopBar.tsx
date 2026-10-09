"use client";
// App shell top bar: brand, synthetic-data label, role switcher, plant selector, chain badge, tabs.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ROLES, TABS, roleOf } from "@/lib/nav";
import { useApp } from "./AppState";

export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative inline-block h-[22px] w-[22px] rounded-[3px] border-[1.5px] border-accent">
        <span className="absolute bottom-[3px] right-[3px] h-2 w-2 rounded-[1px] bg-accent" />
      </span>
      <span className="text-[15px] font-semibold leading-none tracking-[0.14em]">VERDANT<span className="text-accent">-X</span></span>
    </div>
  );
}

export function SyntheticTag() {
  return (
    <span className="rounded-[3px] border border-warn px-1.5 py-1 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-warn">
      Synthetic demo data
    </span>
  );
}

export function TopBar({ publicLink = false }: { publicLink?: boolean }) {
  const path = usePathname();
  const role = roleOf(path);
  const { plants, plantId, setPlantId, info, theme, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);
  const current = plants.find((p) => p.id === plantId);
  const tabs = publicLink ? [] : TABS[role];

  return (
    <header className="relative border-b border-line bg-surface">
      <div className="flex min-h-9 flex-wrap items-center gap-5 px-4 py-3 sm:px-7">
        <div className="flex items-center gap-3.5">
          <Link href="/" className="text-ink no-underline hover:no-underline"><BrandMark /></Link>
          <SyntheticTag />
        </div>

        {publicLink ? (
          <span className="inline-flex items-center gap-2 text-small text-ink-2">
            <span className="h-[7px] w-[7px] rounded-full border-[1.5px] border-ink-3" />
            EU importer · public disclosure link · no login
          </span>
        ) : (
          <nav className="flex gap-0.5 rounded-lg border border-line bg-bg p-[3px]">
            {ROLES.map((r) => (
              <Link
                key={r.id} href={r.home}
                className={r.id === role
                  ? "rounded-[6px] bg-surface-2 px-3.5 py-[7px] text-[13px] font-medium leading-none text-ink no-underline shadow-[inset_0_0_0_1px_var(--vx-line)] hover:no-underline"
                  : "rounded-[6px] px-3.5 py-[7px] text-[13px] leading-none text-ink-3 no-underline hover:text-ink hover:no-underline"}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex-1" />

        {!publicLink && role !== "importer" && role !== "regulator" && (
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex h-[34px] items-center gap-2.5 rounded-[7px] border border-line bg-bg px-3 text-[13px] font-medium"
            >
              <span className="font-mono text-[11px] font-normal text-ink-3">{plantId}</span>
              {current ? current.name.replace(" (synthetic)", "") + " – " + current.city : "…"}
              <span className="text-[10px] text-ink-3">▾</span>
            </button>
            {open && (
              <div className="absolute right-0 top-10 z-20 w-[300px] rounded-lg border border-line bg-surface p-1 shadow-card">
                {plants.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPlantId(p.id); setOpen(false); }}
                    className="flex w-full items-center gap-2.5 rounded-[5px] px-2.5 py-[9px] text-left text-[13px] hover:bg-surface-2"
                  >
                    <span className="w-[78px] font-mono text-[11px] text-ink-3">{p.id}</span>
                    <span className="flex-1">{p.name.replace(" (synthetic)", "")} – {p.city}</span>
                    <span className="text-accent">{p.id === plantId ? "✓" : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="inline-flex h-[34px] items-center gap-2 rounded-[7px] border border-line px-3 text-[12px] font-medium text-ink-2">
          <span className={`h-[7px] w-[7px] rounded-full ${info ? "bg-pass" : "bg-ink-3"}`} />
          {info?.chain.label ?? "Connecting…"}
        </span>
        <button
          onClick={toggleTheme} aria-label="Toggle light and dark theme"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[7px] border border-line text-[14px] text-ink-2 hover:text-ink"
        >
          {theme === "dark" ? "☾" : "☀"}
        </button>
      </div>

      {tabs.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-t border-line-soft px-4 sm:px-7">
          {tabs.map((t) => (
            <Link
              key={t.href} href={t.href}
              className={path === t.href || (t.href !== "/" + role && path.startsWith(t.href))
                ? "whitespace-nowrap border-b-2 border-accent px-3 pb-[11px] pt-3 text-[13px] font-medium leading-none text-ink no-underline hover:no-underline"
                : "whitespace-nowrap border-b-2 border-transparent px-3 pb-[11px] pt-3 text-[13px] leading-none text-ink-3 no-underline hover:text-ink hover:no-underline"}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
