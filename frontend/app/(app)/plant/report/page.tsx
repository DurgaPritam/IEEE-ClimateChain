"use client";
import Link from "next/link";
import { api, reportId } from "@/lib/api";
import { cementTypeLabel, periodLabel, pretty } from "@/lib/format";
import type { Report } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { Pill } from "@/components/ui/Pill";
import { CheckList } from "@/components/CheckList";
import { Banner, Empty, Page, PageHeader } from "@/components/ui";

/** Per-tonne-of-cement contribution of each source (clinker components scaled by the clinker ratio). */
function sources(r: Report) {
  const b = r.result.breakdown, x = r.inputs;
  const perClk = (v: number) => (v / x.clinker_produced_t) * b.clinker_ratio;
  return [
    { name: "Calcination", kind: "direct", v: perClk(b.calcination_tco2) },
    { name: "Kiln fuel", kind: "direct", v: perClk(b.kiln_fuel_tco2) },
    { name: "Kiln electricity", kind: "indirect", v: perClk(b.kiln_electricity_tco2) },
    { name: "Grinding electricity", kind: "indirect", v: b.grinding_electricity_tco2 / x.cement_produced_t },
  ];
}

export default function ReportPage() {
  const { plantId, period } = useApp();
  const { data: r, error, loading } = useAsync(() => api.report(reportId(plantId, period)), [plantId, period]);

  if (loading && !r) return <Page><span className="text-ink-3">Loading…</span></Page>;
  if (error || !r) {
    return (
      <Page>
        <Empty title={`No report for ${periodLabel(period)} yet`}>
          Submit this month&apos;s data first. <Link href="/plant/submit">Go to Submit month →</Link>
        </Empty>
      </Page>
    );
  }

  const checks = r.guard.checks;
  const nPass = checks.filter((c) => c.severity === "pass").length;
  const nWarn = checks.filter((c) => c.severity === "warn").length;
  const blocks = checks.filter((c) => c.severity === "block");
  const blocked = r.guard.blocked;
  const src = sources(r);
  const total = src.reduce((a, s) => a + s.v, 0);
  const signedAlready = r.status === "plant_signed" || r.status === "verified";

  const summary = blocked ? `${nPass} pass · ${blocks.length} blocked` : nWarn ? `${nPass} pass · ${nWarn} need review` : `${nPass} of ${checks.length} checks pass`;

  return (
    <Page className="flex flex-col gap-5">
      <PageHeader
        kicker={`Report · ${periodLabel(r.period)} · ${r.plant_id} · ${cementTypeLabel(r.inputs.cement_type)}`}
        title="Embedded emissions and plausibility"
        right={<>{summary}<Pill status={r.guard.status} /></>}
      />

      {blocked ? (
        <Banner tone="block" title="Blocked · cannot sign · returned to plant">
          <span className="max-w-[900px] text-[22px] font-medium leading-[1.3] [text-wrap:pretty]">{pretty(blocks[0].reason)}</span>
          <span className="text-[14px] text-ink-2">
            Expected {pretty(blocks[0].expected)} · reported {pretty(blocks[0].reported)}. Nothing has been signed or written on-chain. Correct the data and resubmit.
          </span>
          {blocks.some((b) => b.rule_id === "calcination_floor") && (
            <Link href={`/story/calcination?plant=${r.plant_id}`} className="text-small">Full-screen view for the video →</Link>
          )}
        </Banner>
      ) : nWarn ? (
        <Banner tone="warn">
          <strong className="font-semibold">{nWarn} check{nWarn > 1 ? "s" : ""} need{nWarn > 1 ? "" : "s"} human review.</strong>{" "}
          You can sign. The verifier sees every flag and its reason before deciding whether to co-sign.
        </Banner>
      ) : (
        <Banner tone="pass" title={`All ${checks.length} checks passed. This report can be signed and anchored.`} />
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section className="vx-card flex min-w-0 flex-[1_1_420px] flex-col gap-5 p-7">
          <span className="vx-label">Embedded emissions intensity · {blocked ? "as reported · not signable" : periodLabel(r.period)}</span>
          <div className="flex flex-wrap items-baseline gap-3.5">
            <span className={`text-display ${blocked ? "text-ink-3" : ""}`}>{r.result.see_total.toFixed(3)}</span>
            <span className="text-[20px] leading-none text-ink-2">t CO₂/t cement</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Direct" value={r.result.see_direct.toFixed(3)} sub="calcination + kiln fuel" />
            <Tile label="Indirect" value={r.result.see_indirect.toFixed(3)} sub="kiln + grinding electricity" />
          </div>
          <div className="flex flex-col gap-3.5 border-t border-line-soft pt-1.5">
            <span className="pt-3.5 text-[14px] font-semibold leading-none">Source breakdown <span className="font-normal text-ink-3">· t CO₂/t cement</span></span>
            {src.map((s) => (
              <div key={s.name} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-small">
                  <span className="text-ink-2">{s.name} <span className="text-ink-3">· {s.kind}</span></span>
                  <span>{s.v.toFixed(3)} <span className="text-ink-3">{Math.round((s.v / total) * 100)}%</span></span>
                </div>
                <div className="h-1.5 rounded-[3px] bg-surface-2"><div className="h-full rounded-[3px] bg-accent" style={{ width: `${(s.v / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="vx-card min-w-0 flex-[1.6_1_600px] overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-[22px] pb-3.5 pt-5">
            <span className="text-h3">Plausibility checks</span>
            <span className="text-[12px] text-ink-3">Thresholds from cement.yaml · every flag has a reason</span>
          </div>
          <CheckList checks={checks} />
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-line bg-surface px-5 py-4">
        <span className="text-small text-ink-2">
          {blocked ? "A block returns the data to the plant. The guard never accuses anyone automatically."
            : nWarn ? "Signing sends the report and its flags to the verifier queue."
              : "Signing creates a hybrid ML-DSA-65 + ECDSA P-256 signature over the report header."}
        </span>
        <div className="flex gap-2.5">
          {!signedAlready && <Link href="/plant/submit" className="vx-btn-ghost no-underline hover:no-underline">Edit data</Link>}
          {blocked ? (
            <button disabled className="vx-btn h-10 border border-dashed border-line bg-surface-2 px-5 font-semibold text-ink-3 opacity-100">Signing unavailable · blocked</button>
          ) : (
            <Link href="/plant/sign" className="vx-btn-primary px-5 no-underline hover:no-underline">
              {signedAlready ? "View signature & anchor →" : "Sign & anchor →"}
            </Link>
          )}
        </div>
      </div>
    </Page>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-bg px-4 py-3.5">
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className="text-[28px] leading-none">{value}</span>
      <span className="text-[12px] text-ink-3">{sub}</span>
    </div>
  );
}
