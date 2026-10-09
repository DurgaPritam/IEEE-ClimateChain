"use client";
import Link from "next/link";
import { use, useMemo } from "react";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { hybridKeyFingerprint, verifyPackage } from "@/lib/verify";
import { useApp } from "@/components/shell/AppState";
import { Hash } from "@/components/ui/Hash";
import { Pill } from "@/components/ui/Pill";
import { Empty, Page, PageHeader } from "@/components/ui";

const FIELD_LABELS: Record<string, string> = {
  see_total: "see_total", see_direct: "see_direct", see_indirect: "see_indirect",
  cn_code: "product_cn", period: "period", plant_id: "installation_id",
};

export default function DisclosurePage({ params }: { params: Promise<{ shipment: string }> }) {
  const { shipment } = use(params);
  const { info } = useApp();
  const { data: pkg, error } = useAsync(() => api.disclosure(shipment), [shipment]);
  const check = useMemo(() => (pkg ? verifyPackage(pkg) : null), [pkg]);

  if (error) return <Page><Empty title="Disclosure link not found">Shipment {shipment} has no allocation.</Empty></Page>;
  if (!pkg || !check) return <Page><span className="text-ink-3">Loading and verifying…</span></Page>;

  const value = (f: string) => pkg.disclosures.find((d) => d.field === f)?.value;
  const importer = info?.importers.find((i) => i.id === pkg.importer_id);
  const ok = (b: boolean) => b;
  const rows = [
    { title: "Report hash", sub: "Recomputed from the signed header (RFC 8785)", ok: check.reportHash, hash: pkg.report_hash },
    { title: "Plant signature · ML-DSA-65 + ECDSA P-256", sub: `Both components verify · key matches header · ${pkg.header.plant_id}`, ok: check.plant.valid && check.plant.keyMatchesHeader, hash: String(pkg.header.plant_key_fingerprint) },
    { title: "Verifier signature · ML-DSA-65 + ECDSA P-256", sub: `${info?.verifier.name ?? "Accredited verifier"} · allow-listed, not the operator`, ok: check.verifier.valid, hash: hybridKeyFingerprint(pkg.verifier_signature) },
    ...(["anchor", "cosign", "allocation"] as const).filter((k) => pkg.receipts[k]).map((k) => ({
      title: `On-chain receipt · ${k === "anchor" ? "anchorReport" : k === "cosign" ? "coSign" : "allocate"}`,
      sub: `Block #${pkg.receipts[k].block != null ? num(pkg.receipts[k].block as number) : "—"}${k === "allocation" ? ` · ${num(pkg.tonnes)} t to this shipment` : ""}`,
      ok: true, hash: pkg.receipts[k].tx_hash, explorer: true, chain: true,
    })),
  ];
  const nPrivate = Object.values(pkg.private_field_groups).reduce((a, b) => a + b, 0);
  const nOk = Object.values(check.disclosures).filter(ok).length;

  return (
    <Page className="flex flex-col gap-5">
      <PageHeader
        kicker={`Disclosure package · issued to ${importer ? importer.name + " (synthetic)" : pkg.importer_id}`}
        title={`Shipment ${pkg.shipment_id}`}
        right={check.valid
          ? <>All checks verified in your browser<Pill status="verified" /></>
          : <>Verification failed in your browser<Pill status="block" label="Do not rely on this" /></>}
      />

      <section className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-px overflow-hidden rounded-lg border border-line bg-line">
        <div className="flex flex-col gap-2 bg-surface px-6 py-[22px] sm:col-span-2">
          <span className="text-[12px] text-ink-3">Verified embedded emissions</span>
          <span className="text-[72px] font-light leading-[0.95] tracking-[-0.03em]">
            {Number(value("see_total")).toFixed(3)} <span className="text-[18px] tracking-normal text-ink-2">t CO₂/t</span>
          </span>
          <span className="text-small text-ink-2">direct {Number(value("see_direct")).toFixed(3)} · indirect {Number(value("see_indirect")).toFixed(3)}</span>
        </div>
        <div className="flex flex-col gap-2 bg-surface px-6 py-[22px]">
          <span className="text-[12px] text-ink-3">Tonnes</span>
          <span className="text-[40px] font-light leading-none">{num(pkg.tonnes)} <span className="text-[15px] text-ink-3">t</span></span>
          <span className="text-small text-ink-2">{pkg.product}</span>
        </div>
        <div className="flex flex-col gap-2 bg-surface px-6 py-[22px]">
          <span className="text-[12px] text-ink-3">Installation · period</span>
          <span className="text-[20px] leading-[1.3]">{pkg.plant_name}</span>
          <span className="font-mono text-small text-ink-2">{String(value("plant_id"))} · {String(value("period"))}</span>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <section className="vx-card min-w-0 flex-[1.4_1_560px] overflow-hidden">
          <div className="flex flex-wrap justify-between gap-3 px-[22px] pb-3.5 pt-5">
            <span className="text-h3">Verification checklist</span>
            <span className="text-[12px] text-ink-3">Checked locally · nothing to trust on this server</span>
          </div>
          {rows.map((c) => (
            <div key={c.title} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3.5 border-t border-line-soft px-[22px] py-3.5 md:grid-cols-[28px_minmax(0,1fr)_auto]">
              {c.ok
                ? <span className="box-border flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-pass text-[11px] font-bold text-pass">✓</span>
                : <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[3px] bg-block text-[11px] font-bold text-on-status">✕</span>}
              <div className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[14px] font-medium leading-[1.3]">{c.title}</span>
                <span className="text-small text-ink-3">{c.sub}{"chain" in c ? " · from the chain, not re-verified here" : ""}</span>
              </div>
              {c.hash && <div className="col-start-2 md:col-start-auto"><Hash value={c.hash} explorer={"explorer" in c} /></div>}
            </div>
          ))}
          <div className="flex flex-col gap-2.5 border-t border-line-soft px-[22px] pb-[18px] pt-3.5">
            <span className="text-[14px] font-medium leading-[1.3]">
              Merkle proof per disclosed field <span className="font-normal text-ink-3">· {nOk} of {pkg.disclosures.length} verify against root 0x{String(pkg.header.merkle_root).slice(0, 4)}…{String(pkg.header.merkle_root).slice(-4)}</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {pkg.disclosures.map((d) => (
                <span key={d.field} title={`${d.field} = ${JSON.stringify(d.value)}`} className="inline-flex h-[26px] items-center gap-1.5 rounded-[5px] border border-line px-[9px] font-mono text-[12px] text-ink-2">
                  <span className={check.disclosures[d.field] ? "text-pass" : "text-block"}>{check.disclosures[d.field] ? "✓" : "✕"}</span>
                  {FIELD_LABELS[d.field] ?? d.field}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-w-0 flex-[1_1_400px] flex-col gap-4 rounded-lg border border-dashed border-line p-[22px]">
          <div className="flex flex-col gap-1.5">
            <span className="vx-label">What you are not seeing</span>
            <span className="text-[22px] leading-[1.3]">{nPrivate} private fields stay with the plant.</span>
            <span className="text-small leading-normal text-ink-2">They are committed in the same Merkle tree, so the plant cannot change them later. You see only that they exist.</span>
          </div>
          {Object.entries(pkg.private_field_groups).map(([name, n], gi) => (
            <div key={name} className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ink-2">{name} <span className="text-ink-3">· {n}</span></span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: n }, (_, i) => (
                  <span key={i} className="h-2.5 rounded-[2px]" style={{ width: [48, 64, 36, 56, 72, 40, 52][(i + gi) % 7], background: "repeating-linear-gradient(135deg,var(--vx-surface-2) 0 3px,var(--vx-line-soft) 3px 6px)" }} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      <Link href={`/d/${pkg.shipment_id}/cost`} className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-[22px] py-[18px] text-ink no-underline hover:no-underline">
        <span className="text-[15px]">CBAM cost for this shipment: default values vs verified</span>
        <span className="font-medium text-accent">Open cost comparison →</span>
      </Link>
    </Page>
  );
}
