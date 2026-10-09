"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, reportId } from "@/lib/api";
import { num, periodLabel } from "@/lib/format";
import type { ComponentSignature, Report } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { Hash } from "@/components/ui/Hash";
import { Pill } from "@/components/ui/Pill";
import { Empty, ErrorNote, Page } from "@/components/ui";

const bytes = (b64: string) => atob(b64).length;
const ALG_META: Record<string, { name: string; sub: string; sigLabel: string }> = {
  "ML-DSA-65": { name: "ML-DSA-65", sub: "NIST FIPS 204 · post-quantum", sigLabel: "signature" },
  "ECDSA-P256-SHA256": { name: "ECDSA P-256", sub: "SHA-256 · classical", sigLabel: "signature (DER)" },
};

export default function SignPage() {
  const { plantId, period, info } = useApp();
  const id = reportId(plantId, period);
  const { data: loaded, error: loadError, loading } = useAsync(() => api.report(id), [id]);
  const [report, setReport] = useState<Report | null>(null);
  const [step, setStep] = useState(0); // 0 = not signed yet; 1 signature; 2 fingerprint; 3 anchored
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setReport(loaded);
    setStep(loaded && (loaded.status === "plant_signed" || loaded.status === "verified") ? 3 : 0);
  }, [loaded]);

  const sign = async () => {
    setBusy(true); setError(null);
    try {
      await api.sign(id);
      const full = await api.report(id); // includes signature sizes and leaf counts
      setReport(full);
      setStep(1);
      setTimeout(() => setStep(2), 1100);
      setTimeout(() => setStep(3), 2300);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (loading && !report) return <Page><span className="text-ink-3">Loading…</span></Page>;
  if (loadError || !report) {
    return <Page><Empty title="Nothing to sign yet">Submit this month first. <Link href="/plant/submit">Submit month →</Link></Empty></Page>;
  }

  const canSign = report.status === "ready" || report.status === "flagged";
  const sig = report.plant_signature;
  const anchor = report.receipts.anchor;
  const verified = report.status === "verified";
  const steps = [
    ["Calculated and checked", `${report.result.see_total.toFixed(3)} t CO₂/t · ${report.guard.checks.filter((c) => c.severity === "pass").length} of ${report.guard.checks.length} checks pass`],
    ["Hybrid signature", "ML-DSA-65 + ECDSA P-256 over the report header"],
    ["Fingerprint anchored", "Report hash and Merkle root written to the registry"],
    [verified ? "Co-signed by verifier" : "Sent to verifier", `${info?.verifier.name ?? "Accredited verifier"} reviews and co-signs`],
  ];

  return (
    <Page className="flex flex-wrap items-start gap-7">
      <aside className="flex min-w-[260px] flex-[0_1_320px] flex-col gap-[22px]">
        <div className="flex flex-col gap-2">
          <span className="vx-label">{periodLabel(report.period)} · {report.plant_id} · {report.result.see_total.toFixed(3)} t CO₂/t</span>
          <h1 className="m-0 text-h1">Sign and anchor</h1>
        </div>
        <ol className="m-0 flex list-none flex-col p-0">
          {steps.map(([title, sub], i) => {
            const done = i === 0 || i < step || (i === 3 && verified);
            const active = !done && (i === step || (step === 0 && i === 1));
            const todo = !done && !active;
            return (
              <li key={i} className="grid min-h-[72px] grid-cols-[28px_1fr] gap-3.5">
                <div className="flex flex-col items-center">
                  {done ? <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-ink">✓</span>
                    : active ? <span className="box-border flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-2 border-accent font-mono text-[12px] font-semibold text-accent">{i + 1}</span>
                      : <span className="box-border flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border border-line font-mono text-[12px] text-ink-3">{i + 1}</span>}
                  {i < steps.length - 1 && <span className="my-1 w-px flex-1 bg-line" />}
                </div>
                <div className="flex flex-col gap-1 pb-[18px] pt-[3px]">
                  <span className={`text-[15px] font-medium leading-[1.3] ${todo ? "text-ink-3" : "text-ink"}`}>{title}</span>
                  <span className="text-small text-ink-3">{sub}</span>
                </div>
              </li>
            );
          })}
        </ol>
        {canSign ? (
          <button onClick={sign} disabled={busy} className="vx-btn-primary h-11">
            {busy ? "Signing and anchoring…" : "Sign & anchor →"}
          </button>
        ) : step > 0 && (
          <div className="flex gap-2">
            <button onClick={() => setStep((s) => Math.max(1, s - 1))} className="vx-btn-ghost h-9 px-3.5 text-[13px] text-ink-2">← Back</button>
            <button onClick={() => setStep((s) => (s >= 3 ? 1 : s + 1))} className="vx-btn-primary h-9 px-3.5 text-[13px]">{step >= 3 ? "Replay" : "Next step →"}</button>
          </div>
        )}
        {report.status === "blocked" && <span className="text-small text-block">This report is blocked by the plausibility guard and cannot be signed.</span>}
        {report.status === "plant_signed" && <Link href="/verifier" className="text-small">Open the verifier queue →</Link>}
        {verified && <Link href="/plant/allocate" className="text-small">Allocate verified tonnes →</Link>}
        <ErrorNote error={error} />
      </aside>

      <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-4">
        {step === 0 && (
          <section className="vx-card flex flex-col gap-3 border-dashed px-6 py-[22px]">
            <span className="text-h3">Ready to sign</span>
            <span className="text-small text-ink-2">
              Signing serialises the report header as canonical JSON (RFC 8785), commits all {report.leaves?.total ?? "—"} fields in a salted Merkle tree,
              signs with ML-DSA-65 and ECDSA P-256, and anchors only the fingerprint on-chain.
            </span>
          </section>
        )}

        {step >= 1 && sig && (
          <section className="vx-card vx-in flex flex-col gap-4 px-6 py-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-h3">1 · Hybrid signature</span>
              <Pill status="signed" label="Signed · both components" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
              {sig.components.map((c) => <SigCard key={c.alg} c={c} />)}
            </div>
            <span className="text-small leading-normal text-ink-2">
              Valid only if both components verify. Domain-separated as <span className="font-mono text-[12px]">VERDANT-X/report-signature/v1</span>. Signed payload: canonical JSON (RFC 8785) report header.
            </span>
          </section>
        )}

        {step >= 2 && report.report_hash && (
          <section className="vx-card vx-in flex flex-col gap-4 px-6 py-[22px]">
            <span className="text-h3">2 · Report fingerprint</span>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-x-4 gap-y-3">
              <span className="text-small text-ink-2">Report hash</span><div><Hash value={report.report_hash} /></div>
              <span className="text-small text-ink-2">Merkle root</span><div><Hash value={String(report.header?.merkle_root)} /></div>
              <span className="text-small text-ink-2">Leaves</span>
              <span className="text-[14px]">{report.leaves?.total} salted fields · <span className="text-ink-3">{report.leaves?.disclosable} disclosable, {report.leaves?.private} private</span></span>
            </div>
          </section>
        )}

        {step >= 3 && anchor && (
          <section className="vx-card vx-in flex flex-col gap-4 px-6 py-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-h3">3 · On-chain anchor</span>
              <Pill status={verified ? "verified" : "anchored"} />
            </div>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-x-4 gap-y-3">
              <span className="text-small text-ink-2">Call</span>
              <span className="break-all font-mono text-[13px]">anchorReport({report.plant_id}, {report.period}, 0x{report.report_hash?.slice(0, 4)}…{report.report_hash?.slice(-4)}, 0x{String(report.header?.merkle_root).slice(0, 4)}…{String(report.header?.merkle_root).slice(-4)})</span>
              <span className="text-small text-ink-2">Transaction</span><div><Hash value={anchor.tx_hash} explorer /></div>
              <span className="text-small text-ink-2">Block</span>
              <span className="font-mono text-[13px]">#{anchor.block != null ? num(anchor.block) : "—"} · {info?.chain.label}</span>
              <span className="text-small text-ink-2">Next</span>
              <span className="text-[14px]">{verified ? "Co-signed · tonnes can be allocated" : "Awaiting verifier co-signature"}</span>
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-line bg-bg px-[22px] py-[18px]">
          <span className="flex flex-none gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
            {[0, 1, 2].map((i) => <span key={i} className="box-border h-2.5 w-2.5 rounded-[2px] border border-line" />)}
          </span>
          <span className="text-[18px] leading-[1.4]">Only a fingerprint goes on-chain.</span>
          <span className="text-small text-ink-3">32-byte hashes and the period. Plant data stays on the plant&apos;s server.</span>
        </div>
      </div>
    </Page>
  );
}

function SigCard({ c }: { c: ComponentSignature }) {
  const meta = ALG_META[c.alg] ?? { name: c.alg, sub: "", sigLabel: "signature" };
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-line-soft bg-bg p-4">
      <div className="flex items-baseline justify-between gap-2"><span className="text-[15px] font-semibold">{meta.name}</span><span className="text-[12px] text-ink-3">{meta.sub}</span></div>
      <div className="flex gap-6">
        <div className="flex flex-col gap-0.5"><span className="text-[26px] leading-none">{num(bytes(c.signature))} B</span><span className="text-[12px] text-ink-3">{meta.sigLabel}</span></div>
        <div className="flex flex-col gap-0.5"><span className="text-[26px] leading-none">{num(bytes(c.public_key))} B</span><span className="text-[12px] text-ink-3">public key</span></div>
      </div>
      <div><Hash label="key fp" value={c.key_fingerprint} /></div>
    </div>
  );
}
