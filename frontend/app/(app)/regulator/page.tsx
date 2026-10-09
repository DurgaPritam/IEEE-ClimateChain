"use client";
// Regulator / customs: read-only audit trail of on-chain events, reports and blocked submissions.
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { Hash } from "@/components/ui/Hash";
import { Pill, reportStatusPill } from "@/components/ui/Pill";
import { Card, Page, PageHeader } from "@/components/ui";

const EVENT_LABELS: Record<string, { label: string; status: "signed" | "anchored" | "verified" | "pass" }> = {
  InstallationRegistered: { label: "Installation registered", status: "pass" },
  VerifierSet: { label: "Verifier allow-listed", status: "pass" },
  ReportAnchored: { label: "Report anchored", status: "anchored" },
  ReportCoSigned: { label: "Report co-signed", status: "verified" },
  TonnesAllocated: { label: "Tonnes allocated", status: "verified" },
};

export default function RegulatorPage() {
  const { info } = useApp();
  const { data, reload, loading } = useAsync(() => api.audit(), []);
  const events = [...(data?.events ?? [])].reverse();
  const reports = data?.reports ?? [];

  return (
    <Page className="flex flex-col gap-5">
      <PageHeader
        kicker={`Read-only · ${info?.chain.label ?? ""}`}
        title="Audit trail"
        right={<>
          {info?.chain.address && <Hash label="registry" value={info.chain.address} kind="address" explorer />}
          <button onClick={reload} className="vx-btn-ghost h-[34px] px-3 text-[13px]">{loading ? "Refreshing…" : "Refresh"}</button>
        </>}
      />
      <div className="flex flex-wrap items-start gap-5">
        <Card title="On-chain events" aside={`${events.length} events · newest first`} padded={false} className="min-w-0 flex-[1.4_1_560px]">
          {events.map((e) => {
            const meta = EVENT_LABELS[e.event] ?? { label: e.event, status: "pass" as const };
            const detail = e.event === "TonnesAllocated" ? `${num(Number(e.kg) / 1000)} t · ${num(Number(e.remaining_kg ?? e.remainingKg ?? 0) / 1000, 1)} t remaining`
              : e.event === "ReportAnchored" ? `period ${e.period} · ${num(Number(e.verified_kg ?? e.verifiedKg) / 1000, 1)} t verifiable`
                : "";
            return (
              <div key={e.tx_hash + e.event} className="grid grid-cols-1 items-center gap-2 border-t border-line-soft px-[22px] py-3 md:grid-cols-[170px_minmax(0,1fr)_auto] md:gap-4">
                <Pill status={meta.status} label={meta.label} />
                <span className="text-small text-ink-2">#{num(e.block)} {detail && `· ${detail}`}</span>
                <Hash value={e.tx_hash} explorer />
              </div>
            );
          })}
        </Card>
        <Card title="Reports" aside="anchored and blocked" padded={false} className="min-w-0 flex-[1_1_380px]">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border-t border-line-soft px-[22px] py-3">
              <span className="font-mono text-[13px]">{r.id}</span>
              <span className="text-small text-ink-2">{r.see_total.toFixed(3)}</span>
              <Pill status={reportStatusPill(r.status)} />
            </div>
          ))}
        </Card>
      </div>
    </Page>
  );
}
