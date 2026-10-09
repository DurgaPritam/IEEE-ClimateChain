"use client";
// CBAM cost: default values vs verified. Three layouts from the design (a ledger, b hero, c over time).
// Every number comes from the backend pricing module (/api/cost/schedule); nothing is computed here.
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { eur, num } from "@/lib/format";
import type { CostComparison } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { Pill } from "@/components/ui/Pill";
import { Empty, Page, PageHeader, Segmented } from "@/components/ui";

type Variant = "a" | "b" | "c";

export default function CostPage({ params }: { params: Promise<{ shipment: string }> }) {
  const { shipment } = use(params);
  const { info } = useApp();
  const [variant, setVariant] = useState<Variant>("a");
  const [year, setYear] = useState(2026);
  const { data, error } = useAsync(async () => {
    const pkg = await api.disclosure(shipment);
    const see = Number(pkg.disclosures.find((d) => d.field === "see_total")?.value);
    const schedule = await api.costSchedule(pkg.tonnes, see, pkg.carbon_price_paid_eur);
    return { pkg, see, schedule };
  }, [shipment]);

  useEffect(() => {
    try { const v = localStorage.getItem("vx.moneyVariant"); if (v === "a" || v === "b" || v === "c") setVariant(v); } catch { /* none */ }
  }, []);
  const pickVariant = (v: Variant) => { setVariant(v); try { localStorage.setItem("vx.moneyVariant", v); } catch { /* none */ } };

  if (error) return <Page><Empty title="Shipment not found" /></Page>;
  if (!data) return <Page><span className="text-ink-3">Loading…</span></Page>;

  const { pkg, see, schedule } = data;
  const c = schedule.find((s) => s.year === year) ?? schedule[0];
  const importer = info?.importers.find((i) => i.id === pkg.importer_id);
  const pct = c.default.net_cost_eur > 0 ? Math.round((c.saving_eur / c.default.net_cost_eur) * 100) : 0;
  const fa = c.default.benchmark_deduction_tco2_per_t;

  return (
    <Page className="flex min-h-[calc(100vh-70px)] flex-col gap-6">
      <PageHeader
        kicker={`${pkg.shipment_id} · ${num(pkg.tonnes)} t · ${pkg.plant_name}${importer ? ` → ${importer.name} (synthetic)` : ""}`}
        title="CBAM certificate cost"
        right={
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[12px] text-ink-3">Surrender year</span>
            <div className="flex flex-wrap gap-0.5 rounded-lg border border-line bg-surface p-[3px]">
              {schedule.map((s) => (
                <button key={s.year} onClick={() => setYear(s.year)}
                  className={s.year === year
                    ? "rounded-[5px] bg-accent px-[9px] py-[7px] font-mono text-[12px] font-semibold leading-none text-accent-ink"
                    : "rounded-[5px] px-[9px] py-[7px] font-mono text-[12px] leading-none text-ink-2 hover:bg-surface-2"}>
                  {s.year}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {variant === "a" && <Ledger c={c} see={see} fa={fa} pct={pct} tonnes={pkg.tonnes} />}
      {variant === "b" && <Hero c={c} see={see} tonnes={pkg.tonnes} />}
      {variant === "c" && <OverTime c={c} see={see} schedule={schedule} setYear={setYear} />}

      <footer className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t border-line-soft pt-3.5 text-[12px] leading-normal text-ink-3">
        <span>Certificate price €{c.certificate_price_eur}/t CO₂ (EU ETS auction average 2026, assumption; held constant)</span>
        <span>Default value {c.default.see_tco2_per_t} t CO₂/t (EU default value, cement — to verify against IR 2025/2621)</span>
        <span>Free-allocation deduction {fa.toFixed(3)} t CO₂/t in {year}</span>
        <span>Turkish carbon price deducted from the verified path only, capped at gross cost (simplified)</span>
        <span className="ml-auto flex items-center gap-2">
          Layout <Segmented options={[{ value: "a", label: "Ledger" }, { value: "b", label: "Hero" }, { value: "c", label: "Over time" }]} value={variant} onChange={pickVariant} />
        </span>
      </footer>
      <Link href={`/d/${pkg.shipment_id}`} className="text-small">← Back to the disclosure package</Link>
    </Page>
  );
}

function Line({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className={`flex justify-between gap-4 text-[14px] ${tone ?? "text-ink-2"}`}>
      <span>{k}</span><span className="whitespace-nowrap">{v}</span>
    </div>
  );
}

function Ledger({ c, see, fa, pct, tonnes }: { c: CostComparison; see: number; fa: number; pct: number; tonnes: number }) {
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-4">
        <section className="vx-card flex flex-col gap-3 px-6 py-[22px]">
          <div className="flex items-baseline justify-between"><span className="text-h3">EU default values</span><span className="text-[12px] text-ink-3">no supplier data</span></div>
          <Line k="Embedded emissions" v={`${c.default.see_tco2_per_t.toFixed(3)} t CO₂/t`} />
          <Line k="Free-allocation deduction" v={`− ${fa.toFixed(3)} t CO₂/t`} />
          <Line k="Certificates required" v={`${num(c.default.obligation_tco2)} t CO₂`} />
          <Line k="Turkish carbon price" v="not deductible on this path" tone="text-ink-3" />
          <div className="flex items-baseline justify-between border-t border-line-soft pt-3"><span className="text-[14px]">Net cost</span><span className="text-[44px] font-light leading-none tracking-[-0.02em]">{eur(c.default.net_cost_eur)}</span></div>
        </section>
        <section className="flex flex-col gap-3 rounded-lg border border-verified bg-surface px-6 py-[22px]">
          <div className="flex items-center justify-between"><span className="text-h3">Verified actual emissions</span><Pill status="verified" /></div>
          <Line k="Embedded emissions" v={`${see.toFixed(3)} t CO₂/t`} />
          <Line k="Free-allocation deduction" v={`− ${fa.toFixed(3)} t CO₂/t`} />
          <Line k="Certificates required" v={`${num(c.verified.obligation_tco2)} t CO₂ · ${eur(c.verified.gross_cost_eur)}`} />
          <Line k="Turkish carbon price paid" v={<span className="text-verified">− {eur(c.verified.carbon_price_deduction_eur)}</span>} />
          <div className="flex items-baseline justify-between border-t border-line-soft pt-3"><span className="text-[14px]">Net cost</span><span className="text-[44px] font-light leading-none tracking-[-0.02em]">{eur(c.verified.net_cost_eur)}</span></div>
        </section>
      </div>
      <section className="flex flex-wrap items-end justify-between gap-6 px-1 pt-2">
        <div className="flex flex-col gap-2.5">
          <span className="vx-label">Saving on this shipment · {c.year}</span>
          <span className="text-display-xl text-verified">{eur(c.saving_eur)}</span>
        </div>
        <span className="max-w-[340px] pb-3.5 text-body text-ink-2">{pct}% lower than paying on EU default values, for the same {num(tonnes)} t of cement.</span>
      </section>
    </>
  );
}

function Hero({ c, see, tonnes }: { c: CostComparison; see: number; tonnes: number }) {
  const max = c.default.net_cost_eur || 1;
  return (
    <>
      <section className="flex flex-col items-center gap-3.5 pb-2 pt-3 text-center">
        <span className="vx-label">The importer saves</span>
        <span className="text-[clamp(96px,11vw,172px)] font-light leading-[0.9] tracking-[-0.04em]">{eur(c.saving_eur)}</span>
        <span className="text-[16px] text-ink-2">on one {num(tonnes)} t shipment, surrendered in {c.year}</span>
      </section>
      <section className="vx-card flex flex-col gap-[18px] px-7 py-6">
        <div className="grid grid-cols-[200px_minmax(0,1fr)_140px] items-center gap-[18px]">
          <div className="flex flex-col gap-0.5"><span className="text-[14px]">EU default values</span><span className="text-[12px] text-ink-3">{c.default.see_tco2_per_t.toFixed(3)} t CO₂/t</span></div>
          <div className="h-7 overflow-hidden rounded-[3px] bg-surface-2"><div className="h-full w-full bg-ink-3" /></div>
          <span className="text-right text-[22px]">{eur(c.default.net_cost_eur)}</span>
        </div>
        <div className="grid grid-cols-[200px_minmax(0,1fr)_140px] items-center gap-[18px]">
          <div className="flex flex-col gap-0.5"><span className="text-[14px]">Verified actual</span><span className="text-[12px] text-ink-3">{see.toFixed(3)} t CO₂/t</span></div>
          <div className="flex h-7 overflow-hidden rounded-[3px] bg-surface-2">
            <div className="h-full bg-verified" style={{ width: `${(c.verified.net_cost_eur / max) * 100}%` }} />
            <div className="h-full opacity-60" style={{ width: `${(c.verified.carbon_price_deduction_eur / max) * 100}%`, background: "repeating-linear-gradient(135deg,var(--vx-verified) 0 3px,transparent 3px 6px)" }} />
          </div>
          <span className="text-right text-[22px]">{eur(c.verified.net_cost_eur)}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-line-soft pt-3.5 text-[14px] text-ink-2">
          <span>▨ Turkish carbon price paid, deducted from the verified path</span><span className="text-ink">− {eur(c.verified.carbon_price_deduction_eur)}</span>
        </div>
      </section>
    </>
  );
}

function OverTime({ c, see, schedule, setYear }: { c: CostComparison; see: number; schedule: CostComparison[]; setYear: (y: number) => void }) {
  const max = Math.max(...schedule.map((s) => s.default.net_cost_eur), 1);
  return (
    <div className="flex flex-wrap items-stretch gap-7">
      <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-10">
        <div className="flex flex-col gap-2.5">
          <span className="vx-label">Saving · {c.year}</span>
          <span className="text-[clamp(80px,8vw,128px)] font-light leading-[0.92] tracking-[-0.035em] text-verified">{eur(c.saving_eur)}</span>
        </div>
        <div className="flex flex-col border-t border-line">
          {[
            [`Default values · ${c.default.see_tco2_per_t.toFixed(3)} t CO₂/t`, eur(c.default.net_cost_eur)],
            [`Verified · ${see.toFixed(3)} t CO₂/t, gross`, eur(c.verified.gross_cost_eur)],
            ["Turkish carbon price paid", `− ${eur(c.verified.carbon_price_deduction_eur)}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line-soft py-3 text-[15px]"><span className="text-ink-2">{k}</span><span className="whitespace-nowrap">{v}</span></div>
          ))}
          <div className="flex justify-between py-3 text-[15px]"><span>Verified, net</span><span className="font-medium">{eur(c.verified.net_cost_eur)}</span></div>
        </div>
      </section>
      <section className="vx-card flex min-w-0 flex-[1.3_1_520px] flex-col gap-3.5 px-6 py-[22px]">
        <div className="flex flex-wrap justify-between gap-3">
          <span className="text-[15px] font-semibold">Net cost by surrender year</span>
          <span className="flex gap-3.5 text-[12px] text-ink-2"><span>▮ <span className="text-ink-3">default</span></span><span className="text-verified">▮ <span className="text-ink-2">verified</span></span></span>
        </div>
        <div className="grid h-[280px] items-end gap-2 border-b border-line" style={{ gridTemplateColumns: `repeat(${schedule.length}, minmax(0,1fr))` }}>
          {schedule.map((s) => (
            <button key={s.year} onClick={() => setYear(s.year)} title={`${s.year}: default ${eur(s.default.net_cost_eur)} · verified ${eur(s.verified.net_cost_eur)}`}
              className={`flex h-full items-end justify-center gap-[3px] rounded-t px-0.5 ${s.year === c.year ? "bg-surface-2" : ""}`}>
              <span className="w-[40%] rounded-t-[2px] bg-ink-3" style={{ height: `${(s.default.net_cost_eur / max) * 100}%` }} />
              <span className="w-[40%] rounded-t-[2px] bg-verified" style={{ height: `${Math.max(0.6, (s.verified.net_cost_eur / max) * 100)}%` }} />
            </button>
          ))}
        </div>
        <div className="grid gap-2 text-center font-mono text-[11px] text-ink-3" style={{ gridTemplateColumns: `repeat(${schedule.length}, minmax(0,1fr))` }}>
          {schedule.map((s) => <span key={s.year}>{s.year}</span>)}
        </div>
        <span className="text-small text-ink-2">Both paths rise as EU free allocation phases out, reaching zero in {schedule[schedule.length - 1].year}.</span>
      </section>
    </div>
  );
}
