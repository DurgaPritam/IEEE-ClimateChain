"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sha256 } from "@noble/hashes/sha2.js";
import { api } from "@/lib/api";
import { FUEL_LABELS, SCENARIO_LABELS, SCENARIO_NOTES, num, periodLabel } from "@/lib/format";
import type { CementInputs, EmissionsResult } from "@/lib/types";
import { useApp } from "@/components/shell/AppState";
import { Card, ErrorNote, Field, NumberInput, Page, PageHeader, Segmented } from "@/components/ui";

const CEMENT_TYPES = [
  { value: "CEM_I", label: "CEM I" }, { value: "CEM_II_A", label: "CEM II/A" },
  { value: "CEM_II_B", label: "CEM II/B" }, { value: "CEM_III_A", label: "CEM III/A" },
];
const FUELS = Object.keys(FUEL_LABELS);

type Form = Omit<CementInputs, "fuels_t"> & { fuels: [string, number | null][] };

const toForm = (x: CementInputs): Form => ({ ...x, fuels: Object.entries(x.fuels_t) });
const toInputs = (f: Form): CementInputs => {
  const { fuels, ...rest } = f;
  return { ...rest, fuels_t: Object.fromEntries(fuels.filter(([, t]) => t != null).map(([k, t]) => [k, t as number])) };
};

export default function SubmitPage() {
  const router = useRouter();
  const { plantId, period, plant } = useApp();
  const [scenario, setScenario] = useState("honest");
  const [kinds, setKinds] = useState<string[]>(["honest"]);
  const [form, setForm] = useState<Form | null>(null);
  const [preview, setPreview] = useState<EmissionsResult | null>(null);
  const [evidence, setEvidence] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.scenarioKinds().then(setKinds).catch(() => {}); }, []);
  useEffect(() => {
    api.scenario(plantId, scenario).then((s) => { setForm(toForm(s.inputs)); setError(null); }).catch(setError);
  }, [plantId, scenario]);

  // Live derived values (no storage, no checks) — debounced.
  useEffect(() => {
    if (!form) return;
    const t = setTimeout(() => {
      api.preview(plantId, period, toInputs(form)).then(setPreview).catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [form, plantId, period]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const onEvidence = async (file: File | undefined) => {
    if (!file) return;
    const digest = sha256(new Uint8Array(await file.arrayBuffer()));
    set("carbon_price_evidence_sha256", Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join(""));
    setEvidence({ name: file.name, size: file.size });
  };

  const submit = async () => {
    if (!form) return;
    setBusy(true); setError(null);
    try {
      await api.submit(plantId, period, toInputs(form));
      router.push("/plant/report");
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const b = preview?.breakdown;
  return (
    <Page className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-5">
        <PageHeader kicker={`Reporting period · ${periodLabel(period)} · ${plantId}`} title="Submit month" />
        <ErrorNote error={error} />
        {form && (
          <>
            <Card title="Production">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-3.5">
                <Field label="Clinker produced" unit="t"><NumberInput value={form.clinker_produced_t} onChange={(v) => set("clinker_produced_t", v ?? 0)} /></Field>
                <Field label="Clinker consumed" unit="t"><NumberInput value={form.clinker_consumed_t} onChange={(v) => set("clinker_consumed_t", v ?? 0)} /></Field>
                <Field label="Additives" unit="t"><NumberInput value={form.additives_t} onChange={(v) => set("additives_t", v ?? 0)} /></Field>
                <Field label="Cement produced" unit="t"><NumberInput value={form.cement_produced_t} onChange={(v) => set("cement_produced_t", v ?? 0)} /></Field>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-small text-ink-2">Cement type</span>
                <Segmented options={CEMENT_TYPES} value={form.cement_type} onChange={(v) => set("cement_type", v)} />
              </div>
            </Card>

            <Card title="Clinker chemistry and kiln fuels">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-3.5">
                <Field label="Clinker CaO" unit="fraction"><NumberInput value={form.clinker_cao} onChange={(v) => set("clinker_cao", v ?? 0)} /></Field>
                <Field label="Clinker MgO" unit="fraction"><NumberInput value={form.clinker_mgo} onChange={(v) => set("clinker_mgo", v ?? 0)} /></Field>
              </div>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2.5 vx-label"><span>Fuel type</span><span>Quantity</span><span /></div>
                {form.fuels.map(([fuel, t], i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2.5">
                    <select
                      className="vx-input" value={fuel}
                      onChange={(e) => set("fuels", form.fuels.map((f, j) => (j === i ? [e.target.value, f[1]] : f)))}
                    >
                      {FUELS.map((k) => <option key={k} value={k}>{FUEL_LABELS[k]}</option>)}
                    </select>
                    <Field label={null} unit="t">
                      <NumberInput value={t} onChange={(v) => set("fuels", form.fuels.map((f, j) => (j === i ? [f[0], v] : f)))} />
                    </Field>
                    <button
                      aria-label="Remove fuel" onClick={() => set("fuels", form.fuels.filter((_, j) => j !== i))}
                      className="h-10 rounded-[7px] border border-line-soft text-[14px] text-ink-3 hover:text-ink"
                    >✕</button>
                  </div>
                ))}
                <button
                  onClick={() => set("fuels", [...form.fuels, ["biomass", 0]])}
                  className="h-9 self-start rounded-[7px] border border-dashed border-line px-3.5 text-[13px] font-medium text-ink-2 hover:text-ink"
                >+ Add fuel</button>
                <span className="text-[12px] text-ink-3">Petcoke · coal · lignite · natural gas · fuel oil · waste tyres · biomass. Biomass share is excluded from fossil CO₂.</span>
              </div>
            </Card>

            <Card title="Electricity, declarations and carbon price">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-3.5">
                <Field label="Electricity · kiln" unit="MWh"><NumberInput value={form.electricity_kiln_mwh} onChange={(v) => set("electricity_kiln_mwh", v ?? 0)} /></Field>
                <Field label="Electricity · grinding" unit="MWh"><NumberInput value={form.electricity_grinding_mwh} onChange={(v) => set("electricity_grinding_mwh", v ?? 0)} /></Field>
                <Field label={<>Reported process CO₂ <span className="text-ink-3">· optional</span></>} unit="t CO₂">
                  <NumberInput value={form.reported_process_co2_t} onChange={(v) => set("reported_process_co2_t", v)} />
                </Field>
                <Field label="Turkish carbon price paid" unit="€"><NumberInput value={form.carbon_price_paid_eur} onChange={(v) => set("carbon_price_paid_eur", v ?? 0)} /></Field>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-small text-ink-2">Declared process change <span className="text-ink-3">· optional</span></span>
                <textarea
                  value={form.declared_process_change ?? ""}
                  onChange={(e) => set("declared_process_change", e.target.value || null)}
                  placeholder="e.g. Switched 10% of thermal input from petcoke to biomass from 3 Dec"
                  className="min-h-16 resize-y rounded-[7px] border border-line bg-bg px-3 py-2.5 text-[14px] leading-normal outline-none"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-dashed border-line px-3.5 py-3">
                <span className="box-border flex h-9 w-[30px] items-end justify-center rounded-[3px] border border-line pb-1 font-mono text-[8px] font-medium leading-none text-ink-3">PDF</span>
                <div className="flex min-w-[200px] flex-1 flex-col gap-[3px]">
                  <span className="text-[14px]">{evidence ? evidence.name : "Evidence for carbon price paid"}</span>
                  <span className="text-[12px] text-ink-3">
                    {evidence
                      ? `${Math.round(evidence.size / 1024)} KB · SHA-256 ${form.carbon_price_evidence_sha256?.slice(0, 12)}… · hashed in your browser, file not uploaded`
                      : "Optional · only its SHA-256 is added to the report; the file stays with the plant"}
                  </span>
                </div>
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => onEvidence(e.target.files?.[0])} />
                <button onClick={() => fileRef.current?.click()} className="vx-btn-ghost h-[34px] px-3 text-[13px]">
                  {evidence ? "Replace" : "Attach"}
                </button>
              </div>
            </Card>
          </>
        )}
      </div>

      <aside className="sticky top-5 flex min-w-[300px] flex-[0_1_380px] flex-col gap-4">
        <section className="vx-card flex flex-col gap-2.5 p-5">
          <span className="vx-label">Load scenario</span>
          <select className="vx-input font-medium" value={scenario} onChange={(e) => setScenario(e.target.value)}>
            {kinds.map((k) => (
              <option key={k} value={k}>{SCENARIO_LABELS[k] ?? k}{k === "honest" && plant ? ` · ${plant.name.split(" ")[0]}` : ""}</option>
            ))}
          </select>
          <span className="text-[12px] leading-[1.45] text-ink-3">{SCENARIO_NOTES[scenario]}</span>
        </section>
        <section className="vx-card flex flex-col gap-3 p-5">
          <span className="vx-label">Derived before checks</span>
          <Row k="Clinker ratio" v={b ? b.clinker_ratio.toFixed(3) : "—"} />
          <Row k="Kiln energy" v={b ? `${b.kiln_gj_per_t_clk.toFixed(2)} GJ/t clinker` : "—"} />
          <Row k="Electricity" v={b ? `${num(b.kwh_per_t_cem)} kWh/t cement` : "—"} />
          <Row k="Preliminary intensity" v={preview ? `${preview.see_total.toFixed(3)} t CO₂/t` : "—"} />
        </section>
        <button onClick={submit} disabled={!form || busy} className="vx-btn-primary h-12 text-[15px]">
          {busy ? "Running checks…" : "Calculate and run checks →"}
        </button>
        <span className="text-[12px] leading-normal text-ink-3">Nothing is signed or sent on-chain at this step. Data stays on the plant&apos;s server.</span>
      </aside>
    </Page>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-[14px]">
      <span className="text-ink-2">{k}</span><span className="tabular-nums">{v}</span>
    </div>
  );
}
