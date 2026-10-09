"use client";
// Full-screen fraud moments for the video, driven by live data:
//   /story/calcination?plant=TR-MAR-03  — latest report blocked by the calcination floor
//   /story/double?available=&requested=&total=  — the contract's OverAllocation revert (from Allocate)
import { useSearchParams } from "next/navigation";
import { Suspense, use } from "react";
import { api } from "@/lib/api";
import { num, periodLabel } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { BrandMark, SyntheticTag } from "@/components/shell/TopBar";

export default function StoryPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = use(params);
  return <Suspense>{kind === "double" ? <Double /> : <Calcination />}</Suspense>;
}

function Frame({ context, kicker, headline, footer, footerRight, children }: {
  context: string; kicker: string; headline: string; footer: string; footerRight: string; children?: React.ReactNode;
}) {
  return (
    <div className="box-border flex min-h-screen flex-col gap-10 border-t-[6px] border-block bg-bg px-6 pb-12 pt-10 sm:px-[72px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5"><BrandMark /><SyntheticTag /></div>
        <span className="font-mono text-small text-ink-3">{context}</span>
      </div>
      <div className="flex max-w-[1180px] flex-1 flex-col justify-center gap-7">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-[5px] bg-block text-[22px] font-bold text-on-status">✕</span>
          <span className="text-[15px] font-semibold uppercase leading-[1.2] tracking-[0.1em] text-block">{kicker}</span>
        </div>
        <h1 className="m-0 text-[clamp(44px,4.4vw,68px)] font-normal leading-[1.12] tracking-[-0.02em] [text-wrap:pretty]">{headline}</h1>
        {children}
      </div>
      <div className="flex flex-wrap justify-between gap-6 border-t border-line pt-5 text-[17px] text-ink-2">
        <span>{footer}</span><span className="text-ink-3">{footerRight}</span>
      </div>
    </div>
  );
}

function Calcination() {
  const plant = useSearchParams().get("plant") ?? "TR-MAR-03";
  const { plants } = useApp();
  const plantName = plants.find((p) => p.id === plant)?.name ?? plant;
  const { data } = useAsync(() => api.plantReports(plant), [plant]);
  const r = [...(data ?? [])].reverse().find((x) => x.guard.checks.some((c) => c.rule_id === "calcination_floor" && c.severity === "block"));
  if (!data) return null;
  if (!r) {
    return <Frame context={`${plant} · plausibility guard`} kicker="No blocked report yet" headline="Submit the “calcination below chemistry” scenario for this plant first." footer="" footerRight="" />;
  }
  const c = r.guard.checks.find((x) => x.rule_id === "calcination_floor")!;
  // "≥ 52,958 t CO2" -> 52958 (first number only; "CO2" must not leak a digit)
  const firstNumber = (s: string | null) => Number((s ?? "").match(/[\d,]+(\.\d+)?/)?.[0].replace(/,/g, "") ?? 0);
  const min = firstNumber(c.expected);
  const rep = firstNumber(c.reported);
  const w = Math.min(100, (rep / min) * 100);

  return (
    <Frame
      context={`${r.plant_id} · ${r.period} · plausibility guard`}
      kicker="Report blocked · returned to plant"
      headline={`Reported process CO₂ is below the chemical minimum for ${num(r.inputs.clinker_produced_t)} t of clinker.`}
      footer="Nothing was signed. Nothing was written on-chain."
      footerRight="Calcination CO₂ is fixed by chemistry"
    >
      <div className="flex max-w-[980px] flex-col gap-3.5 pt-2">
        <div className="grid grid-cols-[220px_minmax(0,1fr)_180px] items-center gap-5">
          <span className="text-[17px] text-ink-2">Chemical minimum</span>
          <div className="h-[22px] rounded-[3px] bg-surface-2"><div className="h-full w-full rounded-[3px] bg-ink-3" /></div>
          <span className="text-right text-[26px]">{num(min)} t</span>
        </div>
        <div className="grid grid-cols-[220px_minmax(0,1fr)_180px] items-center gap-5">
          <span className="text-[17px] text-ink-2">Reported process CO₂</span>
          <div className="relative h-[22px] rounded-[3px] bg-surface-2">
            <div className="h-full rounded-[3px] bg-block" style={{ width: `${w}%` }} />
            <span className="absolute -bottom-2 -top-2 border-l border-dashed border-ink-2" style={{ left: `${w}%` }} />
          </div>
          <span className="text-right text-[26px] text-block">{num(rep)} t</span>
        </div>
        <span className="pl-0 text-[15px] text-ink-3 sm:pl-[240px]">
          {num(r.inputs.clinker_produced_t)} t clinker × (0.785 · CaO + 1.092 · MgO), −2% tolerance · {plantName}, {periodLabel(r.period)}
        </span>
      </div>
    </Frame>
  );
}

function Double() {
  const q = useSearchParams();
  const { info } = useApp();
  const available = Number(q.get("available") ?? 0);
  const requested = Number(q.get("requested") ?? 10000);
  const total = Number(q.get("total") ?? 0);
  return (
    <Frame
      context={`VerdantRegistry · allocate() · ${info?.chain.label ?? ""}`}
      kicker="Rejected by contract"
      headline={`Over-allocation rejected by contract: ${num(available, 1)} t available, ${num(requested)} t requested.`}
      footer="The same verified tonne cannot be sold to two importers."
      footerRight="Enforced on-chain, across importers who never talk to each other"
    >
      <div className="flex max-w-[1060px] flex-col gap-4 pt-2">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-3">
          {[
            ["Verified for the month", `${num(total, 1)} t`, ""],
            ["Already allocated", `${num(total - available, 1)} t`, ""],
            ["Requested again", `${num(requested)} t`, "text-block"],
          ].map(([k, v, tone]) => (
            <div key={k} className="flex flex-col gap-1.5 bg-surface px-[22px] py-5">
              <span className="text-[14px] text-ink-3">{k}</span>
              <span className={`text-[40px] font-light leading-none ${tone}`}>{v}</span>
            </div>
          ))}
        </div>
        <span className="font-mono text-[15px] text-ink-2">
          revert OverAllocation(available={num(available * 1000)}, requested={num(requested * 1000)} kg) · rejected in a pre-flight call, no gas spent
        </span>
      </div>
    </Frame>
  );
}
