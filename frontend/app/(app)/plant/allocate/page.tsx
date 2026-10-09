"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, api, reportId } from "@/lib/api";
import { cementTypeLabel, num, periodLabel } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { Hash } from "@/components/ui/Hash";
import { Pill } from "@/components/ui/Pill";
import { Empty, ErrorNote, Field, NumberInput, Page, PageHeader, Stat } from "@/components/ui";

const t1 = (n: number) => num(n, 1);

export default function AllocatePage() {
  const { plantId, period, info } = useApp();
  const id = reportId(plantId, period);
  const { data: r, error: loadError, loading, reload } = useAsync(() => api.report(id), [id]);
  const importers = info?.importers ?? [];
  const [importer, setImporter] = useState("");
  const [tonnesReq, setTonnesReq] = useState<number | null>(10000);
  const [shipment, setShipment] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<{ available: number; requested: number } | null>(null);
  const [error, setError] = useState<unknown>(null);

  const n = r?.allocations?.length ?? 0;
  useEffect(() => { setShipment(`SHP-${period.replace("-", "")}-${String(n + 1).padStart(2, "0")}`); }, [n, period]);
  useEffect(() => { if (!importer && importers[0]) setImporter(importers[0].id); }, [importers, importer]);

  if (loading && !r) return <Page><span className="text-ink-3">Loading…</span></Page>;
  if (loadError || !r) return <Page><Empty title="No report this month">Submit, sign and get the report co-signed first.</Empty></Page>;
  if (r.status !== "verified") {
    return (
      <Page className="flex flex-col gap-5">
        <PageHeader kicker={`${periodLabel(period)} · ${plantId}`} title="Allocate tonnes" />
        <Empty title="Only verified reports can be allocated">
          Current status: <strong>{r.status.replace("_", " ")}</strong>.{" "}
          {r.status === "plant_signed" ? <Link href="/verifier">Waiting for the verifier to co-sign →</Link> : <Link href="/plant/sign">Sign & anchor →</Link>}
        </Empty>
      </Page>
    );
  }

  const total = r.result.product_tonnes;
  const remaining = r.remaining_tonnes ?? 0;
  const allocated = total - remaining;
  const pct = (allocated / total) * 100;
  const nameOf = (iid: string) => importers.find((i) => i.id === iid);

  const allocate = async () => {
    if (!tonnesReq) return;
    setBusy(true); setError(null); setRejected(null);
    try {
      await api.allocate(id, shipment, importer, tonnesReq);
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === "chain:OverAllocation" && e.detail && typeof e.detail === "object") {
        const d = e.detail as { available_kg: number; requested_kg: number };
        setRejected({ available: d.available_kg / 1000, requested: d.requested_kg / 1000 });
      } else setError(e);
    } finally { setBusy(false); }
  };

  return (
    <Page className="flex flex-col gap-5">
      <PageHeader
        kicker={`${periodLabel(period)} · ${plantId} · ${cementTypeLabel(r.inputs.cement_type)} · ${r.result.see_total.toFixed(3)} t CO₂/t`}
        title="Allocate tonnes" right={<Pill status="verified" />}
      />

      <section className="vx-card flex flex-col gap-4 p-6">
        <div className="flex flex-wrap gap-10">
          <Stat label="Verified total" value={t1(total)} unit="t" />
          <Stat label="Allocated" value={t1(allocated)} unit="t" />
          <Stat label="Remaining" value={t1(remaining)} unit="t" tone={rejected ? "var(--vx-block)" : undefined} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative h-3.5 overflow-hidden rounded-[3px] border border-line bg-[repeating-linear-gradient(135deg,var(--vx-surface-2)_0_6px,var(--vx-bg)_6px_12px)]">
            <div className="absolute inset-y-0 left-0 bg-verified transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap justify-between gap-4 text-[12px] text-ink-3">
            <span className="whitespace-nowrap">■ allocated {Math.round(pct)}%</span>
            <span className="whitespace-nowrap">▨ remaining · enforced by VerdantRegistry.allocate</span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <section className="vx-card min-w-0 flex-[1.6_1_600px] overflow-hidden">
          <div className="px-[22px] pb-3.5 pt-5 text-h3">Shipments</div>
          <div className="hidden grid-cols-[130px_minmax(0,1fr)_110px_270px] gap-4 border-y border-line-soft px-[22px] py-2 vx-label md:grid">
            <span>Shipment</span><span>Importer</span><span className="text-right">Tonnes</span><span>Transaction</span>
          </div>
          {(r.allocations ?? []).length === 0 && <div className="border-t border-line-soft px-[22px] py-4 text-small text-ink-3">No shipments yet.</div>}
          {(r.allocations ?? []).map((a) => {
            const imp = nameOf(a.importer_id);
            return (
              <div key={a.shipment_id} className="grid grid-cols-1 items-center gap-2 border-b border-line-soft px-[22px] py-3 md:grid-cols-[130px_minmax(0,1fr)_110px_270px] md:gap-4">
                <Link href={`/d/${a.shipment_id}`} className="font-mono text-[13px]" title="Open the importer's disclosure link">{a.shipment_id} ↗</Link>
                <span className="min-w-0 text-[14px]">{imp ? `${imp.name} (synthetic)` : a.importer_id} <span className="text-ink-3">· {imp?.port}</span></span>
                <span className="text-[14px] md:text-right">{t1(a.tonnes)}</span>
                <div><Hash value={a.receipt.tx_hash} explorer /></div>
              </div>
            );
          })}
        </section>

        <section className="vx-card flex min-w-0 flex-[1_1_380px] flex-col gap-3.5 p-[22px]">
          <span className="text-h3">Allocate to shipment</span>
          <Field label="Shipment ID"><input className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-[14px] outline-none" value={shipment} onChange={(e) => setShipment(e.target.value)} /></Field>
          <label className="flex flex-col gap-1.5">
            <span className="text-small text-ink-2">Importer</span>
            <select className="vx-input text-[14px]" value={importer} onChange={(e) => setImporter(e.target.value)}>
              {importers.map((i) => <option key={i.id} value={i.id}>{i.name} (synthetic) · {i.port}</option>)}
            </select>
          </label>
          <Field label="Tonnes of cement" unit="t" invalid={!!rejected}>
            <NumberInput value={tonnesReq} onChange={setTonnesReq} />
          </Field>
          <button onClick={() => setTonnesReq(Math.round(remaining) + 10000)} className="self-start text-[12px] text-accent hover:underline">
            Demo: request remaining + 10,000 t
          </button>
          {rejected && (
            <div className="vx-in flex gap-3 rounded-lg border-[1.5px] border-block bg-block-bg p-3.5">
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[3px] bg-block text-[12px] font-bold text-on-status">✕</span>
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold leading-[1.4]">
                  Over-allocation rejected by contract: {num(rejected.available, 1)} t available, {num(rejected.requested)} t requested.
                </span>
                <span className="font-mono text-[12px] leading-[1.4] text-ink-2">
                  revert OverAllocation(available={num(rejected.available * 1000)}, requested={num(rejected.requested * 1000)} kg)
                </span>
                <Link href={`/story/double?available=${rejected.available}&requested=${rejected.requested}&total=${total}`} className="text-[12px]">
                  Full-screen view for the video →
                </Link>
              </div>
            </div>
          )}
          <ErrorNote error={error} />
          <button onClick={allocate} disabled={busy || !tonnesReq || !importer} className="vx-btn-primary h-11">
            {busy ? "Waiting for the contract…" : `Allocate ${num(tonnesReq ?? 0)} t`}
          </button>
          <span className="text-[12px] leading-normal text-ink-3">The contract checks remaining tonnes before writing. The same verified tonne cannot be allocated twice.</span>
        </section>
      </div>
    </Page>
  );
}
