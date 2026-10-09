// Plausibility checklist rows (status, rule and reason, expected, reported) + SHAP contributions.
import { num, pretty } from "@/lib/format";
import type { Check } from "@/lib/types";
import { Pill } from "@/components/ui/Pill";

export function CheckList({ checks }: { checks: Check[] }) {
  return (
    <>
      <div className="hidden grid-cols-[136px_minmax(0,1fr)_120px_120px] gap-4 border-y border-line-soft px-[22px] py-2 vx-label md:grid">
        <span>Status</span><span>Rule · reason</span><span>Expected</span><span>Reported</span>
      </div>
      {checks.map((c) => <CheckRow key={c.rule_id} c={c} />)}
    </>
  );
}

export function CheckRow({ c }: { c: Check }) {
  const bg = c.severity === "block" ? "bg-block-bg" : c.severity === "warn" ? "bg-warn-bg" : "";
  const color = c.severity === "block" ? "text-block" : c.severity === "warn" ? "text-warn" : "text-ink";
  return (
    <div className={`grid grid-cols-1 items-start gap-2 border-b border-line-soft px-[22px] py-[13px] md:grid-cols-[136px_minmax(0,1fr)_120px_120px] md:gap-4 ${bg}`}>
      <Pill status={c.severity} />
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[14px] font-medium leading-[1.3]">{c.title}</span>
        <span className="text-small text-ink-2 [text-wrap:pretty]">{pretty(c.reason)}</span>
        {c.contributions && <Contributions values={c.contributions} />}
      </div>
      <span className="pt-0.5 font-mono text-[13px] leading-[1.4] text-ink-2">{pretty(c.expected) || "—"}</span>
      <span className={`pt-0.5 font-mono text-[13px] font-medium leading-[1.4] ${color}`}>{pretty(c.reported) || "—"}</span>
    </div>
  );
}

const FEATURE_LABELS: Record<string, string> = {
  kiln_gj_per_t_clk: "Kiln energy", kwh_per_t_cem: "Electricity", clinker_ratio: "Clinker ratio",
  clinker_cao: "CaO", fuel_co2_per_t_clk: "Fuel CO₂ per t clinker", see_total: "Intensity",
};

/** SHAP contributions: negative values push towards "anomalous" (shown as bars to the right, in warn color). */
function Contributions({ values }: { values: Record<string, number> }) {
  const rows = Object.entries(values).map(([k, v]) => [k, -v] as const).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...rows.map(([, v]) => Math.abs(v)), 1e-9);
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <span className="text-[12px] text-ink-3">Feature contributions to the anomaly score (SHAP)</span>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[150px_minmax(0,1fr)_52px] items-center gap-2 text-[12px]">
          <span className="text-ink-2">{FEATURE_LABELS[k] ?? k}</span>
          <div className="relative h-2 rounded-[2px] bg-surface-2">
            <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
            <span
              className={`absolute inset-y-0 rounded-[2px] ${v >= 0 ? "bg-warn" : "bg-ink-3"}`}
              style={v >= 0 ? { left: "50%", width: `${(v / max) * 50}%` } : { right: "50%", width: `${(-v / max) * 50}%` }}
            />
          </div>
          <span className="text-right font-mono text-ink-2">{v >= 0 ? "+" : ""}{num(v, 3)}</span>
        </div>
      ))}
    </div>
  );
}
