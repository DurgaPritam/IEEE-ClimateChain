"use client";
// Regulator / customs: live, read-only audit trail — what was verified, what was sold, and what was refused.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import type { Rejection } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { Hash } from "@/components/ui/Hash";
import { Pill, reportStatusPill } from "@/components/ui/Pill";
import { Card, Page, PageHeader, Stat } from "@/components/ui";

const POLL_MS = 4000;

const EVENT_LABELS: Record<string, { label: string; status: "signed" | "anchored" | "verified" | "pass" }> = {
  InstallationRegistered: { label: "Installation registered", status: "pass" },
  VerifierSet: { label: "Verifier allow-listed", status: "pass" },
  ReportAnchored: { label: "Report anchored", status: "anchored" },
  ReportCoSigned: { label: "Report co-signed", status: "verified" },
  TonnesAllocated: { label: "Tonnes allocated", status: "verified" },
};

const REJECTION_LABELS: Record<string, string> = {
  OverAllocation: "Double sale blocked",
  PeriodAlreadyReported: "Second report blocked",
  VerifierIsOperator: "Self-verification blocked",
};

function rejectionLabel(x: Rejection) {
  if (x.action === "submit") return "Submission blocked";
  return REJECTION_LABELS[x.error] ?? `Contract refused · ${x.error}`;
}

function rejectionDetail(x: Rejection) {
  if (x.error === "OverAllocation") {
    const kg = (k: string) => Number(x.detail[k] ?? 0) / 1000;
    return `${x.report_id} → ${x.importer_id ?? "importer"} · requested ${num(kg("requested_kg"), 1)} t, only ${num(kg("available_kg"), 1)} t left`;
  }
  return `${x.report_id} · ${x.message}`;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function RegulatorPage() {
  const { info } = useApp();
  const [live, setLive] = useState(true);
  const { data, reload } = useAsync(() => api.audit(), []);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") reload(); }, POLL_MS);
    return () => clearInterval(id);
  }, [live, reload]);

  // Highlight rows that arrived since the previous poll (not on first load).
  const seen = useRef<Set<string> | null>(null);
  const keys = [...(data?.events ?? []).map((e) => e.tx_hash + e.event), ...(data?.rejections ?? []).map((x) => x.at + x.error)];
  const fresh = new Set(seen.current ? keys.filter((k) => !seen.current!.has(k)) : []);
  useEffect(() => { if (data) seen.current = new Set(keys); });  // eslint-disable-line react-hooks/exhaustive-deps

  const events = [...(data?.events ?? [])].reverse();
  const rejections = data?.rejections ?? [];
  const reports = data?.reports ?? [];
  const s = data?.stats;

  return (
    <Page className="flex flex-col gap-5">
      <PageHeader
        kicker={`Read-only · ${info?.chain.label ?? ""}`}
        title="Audit trail"
        right={<>
          {info?.chain.address && <Hash label="registry" value={info.chain.address} kind="address" explorer />}
          <button onClick={() => setLive((l) => !l)} className="vx-btn-ghost h-[34px] gap-2 px-3 text-[13px]" aria-pressed={live}>
            <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-verified" : "bg-ink-3"}`} />
            {live ? "Live" : "Paused"}
          </button>
        </>}
      />

      {s && (
        <section className="vx-card grid grid-cols-2 gap-6 px-6 py-[22px] lg:grid-cols-4">
          <Stat label="Verified emissions on record" value={num(s.verified_tco2)} unit="t CO₂"
            sub={`${s.verified_reports} co-signed reports · ${num(s.verified_tonnes)} t cement`} />
          <Stat label="Sold to EU importers" value={num(s.allocated_tonnes)} unit="t"
            sub={s.allocated_tco2_default > 0
              ? `${num(s.allocated_tco2_verified)} t CO₂ measured vs ${num(s.allocated_tco2_default)} t on EU defaults`
              : "no shipments yet"} />
          <Stat label="Double sales blocked" value={s.double_count_attempts_blocked} tone="var(--vx-block)"
            sub="on-chain, before any certificate is claimed" />
          <Stat label="Submissions blocked" value={s.blocked_submissions} tone="var(--vx-block)"
            sub="by chemistry, physics and history checks" />
        </section>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <Card title="On-chain events" aside={`${events.length} events · newest first${live ? ` · refreshes every ${POLL_MS / 1000} s` : ""}`}
          padded={false} className="min-w-0 flex-[1.4_1_560px]">
          {events.map((e) => {
            const meta = EVENT_LABELS[e.event] ?? { label: e.event, status: "pass" as const };
            const detail = e.event === "TonnesAllocated" ? `${num(Number(e.kg) / 1000)} t · ${num(Number(e.remaining_kg ?? e.remainingKg ?? 0) / 1000, 1)} t remaining`
              : e.event === "ReportAnchored" ? `period ${e.period} · ${num(Number(e.verified_kg ?? e.verifiedKg) / 1000, 1)} t verifiable`
                : "";
            const isNew = fresh.has(e.tx_hash + e.event);
            return (
              <div key={e.tx_hash + e.event}
                className={`grid grid-cols-1 items-center gap-2 border-t border-line-soft px-[22px] py-3 md:grid-cols-[170px_minmax(0,1fr)_auto] md:gap-4 ${isNew ? "vx-in bg-verified-bg" : ""}`}>
                <Pill status={meta.status} label={meta.label} />
                <span className="text-small text-ink-2">#{num(e.block)} {detail && `· ${detail}`}</span>
                <Hash value={e.tx_hash} explorer />
              </div>
            );
          })}
        </Card>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
          <Card title="Refused" aside="what did not happen · newest first" padded={false}>
            {rejections.length === 0 && <p className="m-0 border-t border-line-soft px-[22px] py-3 text-small text-ink-3">Nothing refused yet.</p>}
            {rejections.map((x) => (
              <div key={x.at + x.error}
                className={`flex flex-col gap-1.5 border-t border-line-soft px-[22px] py-3 ${fresh.has(x.at + x.error) ? "vx-in bg-block-bg" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <Pill status="block" label={rejectionLabel(x)} />
                  <span className="text-[12px] tabular-nums text-ink-3">{time(x.at)}</span>
                </div>
                <span className="text-small text-ink-2">{rejectionDetail(x)}</span>
              </div>
            ))}
          </Card>
          <Card title="Reports" aside="anchored and blocked" padded={false}>
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-t border-line-soft px-[22px] py-3">
                <span className="font-mono text-[13px]">{r.id}</span>
                <span className="text-small text-ink-2">{r.see_total.toFixed(3)}</span>
                <Pill status={reportStatusPill(r.status)} />
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Page>
  );
}
