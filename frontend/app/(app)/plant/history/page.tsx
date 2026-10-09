"use client";
import { api } from "@/lib/api";
import { pretty } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { Pill } from "@/components/ui/Pill";
import { Page, PageHeader } from "@/components/ui";

const LETTERS = "JFMAMJJASOND";

export default function HistoryPage() {
  const { plantId, period } = useApp();
  const { data: reports } = useAsync(() => api.plantReports(plantId), [plantId]);
  if (!reports) return <Page><span className="text-ink-3">Loading…</span></Page>;

  const rows = reports.map((r) => ({
    period: r.period, v: r.result.see_total, blocked: r.status === "blocked", live: r.period === period,
    block: r.guard.checks.find((c) => c.severity === "block"),
  }));
  const accepted = rows.filter((r) => !r.blocked);
  const mean = accepted.reduce((a, r) => a + r.v, 0) / Math.max(1, accepted.length);
  const values = rows.map((r) => r.v);
  const lo = Math.floor((Math.min(...values) - 0.03) * 20) / 20;
  const hi = Math.ceil((Math.max(...values) + 0.03) * 20) / 20;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const ticks = [hi, hi - (hi - lo) / 3, lo + (hi - lo) / 3, lo];
  const first = rows[0]?.period, last = rows[rows.length - 1]?.period;
  const years = Array.from(new Set(rows.map((r) => r.period.slice(0, 4))));

  return (
    <Page className="flex flex-col gap-5">
      <PageHeader
        kicker={`${plantId} · ${first} – ${last}`}
        title="Emissions intensity history"
        right={
          <div className="flex gap-7">
            <Mini label="Accepted months" value={String(accepted.length)} />
            <Mini label="Blocked" value={String(rows.length - accepted.length)} tone="text-block" />
            <Mini label="Mean, accepted" value={mean.toFixed(3)} unit="t CO₂/t" />
          </div>
        }
      />

      <section className="vx-card flex flex-col gap-3.5 px-6 pb-[18px] pt-6">
        <div className="flex flex-wrap justify-between gap-3 text-[12px] text-ink-2">
          <span className="text-[15px] font-semibold text-ink">t CO₂ per t cement</span>
          <div className="flex items-center gap-[18px]">
            <span className="flex items-center gap-1.5"><span className="h-[9px] w-[9px] rounded-full bg-accent" />Accepted</span>
            <span className="flex items-center gap-1.5"><span className="flex h-[11px] w-[11px] items-center justify-center rounded-[2px] bg-block text-[8px] font-bold text-on-status">✕</span>Blocked · value as reported</span>
            <span className="flex items-center gap-1.5"><span className="box-border h-[9px] w-[9px] rounded-full border-2 border-accent" />Live month</span>
          </div>
        </div>
        <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
          <div className="flex h-[300px] flex-col justify-between text-right font-mono text-[11px] text-ink-3">
            {ticks.map((t) => <span key={t}>{t.toFixed(2)}</span>)}
          </div>
          <div className="relative h-[300px] border-b border-line" style={{ background: "linear-gradient(var(--vx-line-soft) 1px, transparent 1px) 0 0/100% 33.333%" }}>
            <div className="absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: pos(mean) }}>
              <span className="absolute -top-[18px] left-1 text-[11px] text-ink-3">mean {mean.toFixed(3)}</span>
            </div>
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0,1fr))` }}>
              {rows.map((m) => (
                <div key={m.period} className="relative" title={`${m.period} · ${m.v.toFixed(3)} t CO₂/t${m.blocked ? " · blocked" : ""}`}
                  style={m.blocked ? { background: "repeating-linear-gradient(135deg, var(--vx-block-bg) 0 4px, transparent 4px 8px)" } : undefined}>
                  {m.blocked ? (
                    <>
                      <span className="absolute left-1/2 -mb-[7.5px] -ml-[7.5px] flex h-[15px] w-[15px] items-center justify-center rounded-[2px] bg-block text-[9px] font-bold text-on-status" style={{ bottom: pos(m.v) }}>✕</span>
                      <span className="absolute left-1/2 -translate-x-1/2 font-mono text-[11px] font-medium text-block" style={{ bottom: `calc(${pos(m.v)} + 14px)` }}>{m.v.toFixed(3)}</span>
                    </>
                  ) : m.live ? (
                    <span className="absolute left-1/2 -mb-[6.5px] -ml-[6.5px] box-border h-[13px] w-[13px] rounded-full border-[2.5px] border-accent bg-surface" style={{ bottom: pos(m.v) }} />
                  ) : (
                    <span className="absolute left-1/2 -mb-[4.5px] -ml-[4.5px] h-[9px] w-[9px] rounded-full bg-accent" style={{ bottom: pos(m.v) }} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <span />
          <div className="grid text-center font-mono text-[11px] text-ink-3" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0,1fr))` }}>
            {rows.map((m) => <span key={m.period}>{LETTERS[Number(m.period.slice(5)) - 1]}</span>)}
          </div>
          <span />
          <div className="grid text-[12px] text-ink-2" style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0,1fr))` }}>
            {years.map((y) => <span key={y} className="border-l border-line pl-1.5">{y}</span>)}
          </div>
        </div>
      </section>

      <section className="vx-card overflow-hidden">
        <div className="px-[22px] pb-3 pt-[18px] text-h3">Blocked months <span className="text-small font-normal text-ink-3">· returned to plant, never signed or anchored</span></div>
        {rows.filter((r) => r.blocked).length === 0 && <div className="border-t border-line-soft px-[22px] py-4 text-small text-ink-3">None. Every month passed the guard.</div>}
        {rows.filter((r) => r.blocked).map((b) => (
          <div key={b.period} className="grid grid-cols-1 items-center gap-2 border-t border-line-soft px-[22px] py-3 md:grid-cols-[110px_120px_minmax(0,1fr)_150px_150px] md:gap-4">
            <span className="font-mono text-[13px] font-medium">{b.period}</span>
            <Pill status="block" />
            <span className="text-[14px]">{b.block?.title} <span className="text-ink-3">· {pretty(b.block?.reason)}</span></span>
            <span className="font-mono text-[12px] text-ink-2">{pretty(b.block?.expected)}</span>
            <span className="font-mono text-[12px] font-medium text-block">{pretty(b.block?.reported)}</span>
          </div>
        ))}
      </section>
    </Page>
  );
}

function Mini({ label, value, unit, tone = "" }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className={`text-[24px] leading-none text-ink ${tone}`}>{value} {unit && <span className="text-[13px] text-ink-3">{unit}</span>}</span>
    </div>
  );
}
