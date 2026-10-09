"use client";
// Verifier: review queue -> report review (every flag, its reason, SHAP contributions) -> co-sign.
// Built from the design system; the dedicated verifier designs come in the second design pass.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cementTypeLabel, num, periodLabel } from "@/lib/format";
import type { Report } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { verifyHybrid } from "@/lib/verify";
import { useApp } from "@/components/shell/AppState";
import { CheckList } from "@/components/CheckList";
import { Hash } from "@/components/ui/Hash";
import { Pill } from "@/components/ui/Pill";
import { Empty, ErrorNote, Page, PageHeader } from "@/components/ui";

export default function VerifierPage() {
  const { info } = useApp();
  const { data: queue, reload } = useAsync(() => api.verifierQueue(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState<Report | null>(null);

  useEffect(() => { if (queue && !selected && queue[0]) setSelected(queue[0].id); }, [queue, selected]);
  const current = queue?.find((r) => r.id === selected) ?? null;

  return (
    <Page className="flex flex-col gap-5">
      <PageHeader kicker={`Accredited verifier · ${info?.verifier.name ?? "…"}`} title="Review queue"
        right={info && <Hash label="key fp" value={info.verifier.key_fingerprint} />} />

      {done && (
        <div className="vx-in flex flex-wrap items-center gap-3 rounded-lg border border-verified bg-verified-bg px-[18px] py-3.5">
          <Pill status="verified" />
          <span className="text-body">{done.plant_id} · {periodLabel(done.period)} co-signed. Tonnes can now be allocated.</span>
          {done.receipts.cosign && <Hash value={done.receipts.cosign.tx_hash} explorer />}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section className="vx-card min-w-[280px] flex-[0_1_340px] overflow-hidden">
          <div className="px-5 pb-3 pt-[18px] text-h3">Awaiting co-signature <span className="font-normal text-ink-3">· {queue?.length ?? 0}</span></div>
          {queue?.length === 0 && <div className="border-t border-line-soft px-5 py-4 text-small text-ink-3">Nothing to review. Plants appear here after they sign and anchor.</div>}
          {queue?.map((r) => (
            <button key={r.id} onClick={() => setSelected(r.id)}
              className={`flex w-full flex-col gap-1.5 border-t border-line-soft px-5 py-3.5 text-left hover:bg-surface-2 ${r.id === selected ? "bg-surface-2 shadow-[inset_3px_0_0_var(--vx-accent)]" : ""}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-[13px]">{r.plant_id} · {r.period}</span>
                <Pill status={r.guard.status === "warn" ? "warn" : "anchored"} label={r.guard.status === "warn" ? `${r.guard.flags.length} flag${r.guard.flags.length > 1 ? "s" : ""}` : "Anchored"} />
              </span>
              <span className="text-small text-ink-2">{r.result.see_total.toFixed(3)} t CO₂/t · {num(r.result.product_tonnes)} t</span>
            </button>
          ))}
        </section>
        <div className="min-w-0 flex-[1_1_640px]">
          {current ? <Review key={current.id} r={current} onDone={(r) => { setDone(r); setSelected(null); reload(); }} />
            : <Empty title="Select a report to review" />}
        </div>
      </div>
    </Page>
  );
}

function Review({ r, onDone }: { r: Report; onDone: (r: Report) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const sigCheck = useMemo(() => (r.plant_signature && r.header ? verifyHybrid(r.header, r.plant_signature) : null), [r]);

  const cosign = async () => {
    setBusy(true); setError(null);
    try { onDone(await api.cosign(r.id, note || undefined)); } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="vx-card flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5">
        <div className="flex flex-col gap-1">
          <span className="vx-label">{r.plant_id} · {periodLabel(r.period)} · {cementTypeLabel(r.inputs.cement_type)}</span>
          <span className="text-[44px] font-light leading-none tracking-[-0.02em]">{r.result.see_total.toFixed(3)} <span className="text-[16px] tracking-normal text-ink-3">t CO₂/t</span></span>
        </div>
        <div className="flex flex-col gap-2 text-small">
          <span className="flex items-center gap-2">
            Plant signature, checked in this browser:
            {sigCheck?.valid ? <Pill status="pass" label="ML-DSA-65 ✓ · ECDSA ✓" /> : <Pill status="block" label="Invalid" />}
          </span>
          <span className="flex flex-wrap items-center gap-2">Anchored <Hash value={r.receipts.anchor?.tx_hash ?? ""} explorer /></span>
        </div>
      </section>

      <section className="vx-card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-3 px-[22px] pb-3.5 pt-5">
          <span className="text-h3">Flags and evidence</span>
          <span className="text-[12px] text-ink-3">The guard flags; you decide. Nothing is accused automatically.</span>
        </div>
        <CheckList checks={r.guard.checks} />
      </section>

      <section className="vx-card flex flex-col gap-3 px-6 py-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-small text-ink-2">Review note <span className="text-ink-3">· kept with your signature record</span></span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Site visit 4 Jan; fuel delivery notes reconcile with kiln energy."
            className="min-h-16 resize-y rounded-[7px] border border-line bg-bg px-3 py-2.5 text-[14px] outline-none" />
        </label>
        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-small text-ink-3">Co-signing creates your own hybrid signature and calls <span className="font-mono">coSign()</span> on-chain.</span>
          <div className="flex gap-2.5">
            <Link href="/regulator" className="vx-btn-ghost no-underline hover:no-underline">Audit trail</Link>
            <button onClick={cosign} disabled={busy || !sigCheck?.valid} className="vx-btn-primary px-5">{busy ? "Co-signing…" : "Co-sign report →"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
