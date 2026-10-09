"use client";
// EU importer: shipments with a disclosure link. In practice the importer only receives the link.
import Link from "next/link";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { useApp } from "@/components/shell/AppState";
import { Hash } from "@/components/ui/Hash";
import { Empty, Page, PageHeader } from "@/components/ui";

export default function ImporterPage() {
  const { info } = useApp();
  const { data } = useAsync(() => api.audit(), []);
  const allocations = data?.allocations ?? [];

  return (
    <Page className="flex flex-col gap-5">
      <PageHeader kicker="EU importer · CBAM declarant" title="Shipments with verified emissions" />
      <span className="max-w-[760px] text-body text-ink-2">
        Importers do not log in. Each shipment comes with a disclosure link that verifies the plant&apos;s and verifier&apos;s
        signatures and the Merkle proofs in the browser.
      </span>
      {allocations.length === 0 ? (
        <Empty title="No shipments yet">Allocate verified tonnes as the plant operator first. <Link href="/plant/allocate">Allocate tonnes →</Link></Empty>
      ) : (
        <section className="vx-card overflow-hidden">
          <div className="hidden grid-cols-[150px_minmax(0,1fr)_120px_130px_auto] gap-4 border-b border-line-soft px-[22px] py-2.5 vx-label md:grid">
            <span>Shipment</span><span>Importer</span><span className="text-right">Tonnes</span><span>Report</span><span>Allocation tx</span>
          </div>
          {allocations.map((a) => {
            const imp = info?.importers.find((i) => i.id === a.importer_id);
            return (
              <div key={a.shipment_id} className="grid grid-cols-1 items-center gap-2 border-b border-line-soft px-[22px] py-3 md:grid-cols-[150px_minmax(0,1fr)_120px_130px_auto] md:gap-4">
                <Link href={`/d/${a.shipment_id}`} className="font-mono text-[13px] font-medium">{a.shipment_id} ↗</Link>
                <span className="text-[14px]">{imp ? `${imp.name} (synthetic)` : a.importer_id} <span className="text-ink-3">· {imp?.port}</span></span>
                <span className="text-[14px] md:text-right">{num(a.tonnes, 1)} t</span>
                <span className="font-mono text-[12px] text-ink-2">{a.report_id}</span>
                <div><Hash value={a.receipt.tx_hash} explorer /></div>
              </div>
            );
          })}
        </section>
      )}
    </Page>
  );
}
