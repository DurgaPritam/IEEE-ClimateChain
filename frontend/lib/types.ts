// Types mirroring the FastAPI responses (backend/app/models.py, store.py, service.py).

export type Severity = "pass" | "warn" | "block";
export type Status = Severity | "signed" | "anchored" | "verified";
export type ReportStatus = "blocked" | "flagged" | "ready" | "plant_signed" | "verified";

export interface Check {
  rule_id: string;
  title: string;
  severity: Severity;
  reason: string;
  expected: string | null;
  reported: string | null;
  contributions: Record<string, number> | null;
}

export interface GuardResult {
  checks: Check[];
  flags: Check[];
  blocked: boolean;
  status: Severity;
}

export interface EmissionsResult {
  sector: string;
  product_tonnes: number;
  direct_tco2: number;
  indirect_tco2: number;
  see_direct: number;
  see_indirect: number;
  see_total: number;
  breakdown: Record<string, number>;
}

export interface CementInputs {
  clinker_produced_t: number;
  clinker_consumed_t: number;
  additives_t: number;
  cement_produced_t: number;
  cement_type: string;
  clinker_cao: number;
  clinker_mgo: number;
  fuels_t: Record<string, number>;
  electricity_kiln_mwh: number;
  electricity_grinding_mwh: number;
  reported_process_co2_t: number | null;
  declared_process_change: string | null;
  carbon_price_paid_eur: number;
  carbon_price_evidence_sha256: string | null;
}

export interface TxReceipt {
  tx_hash: string;
  block: number | null;
  explorer_url: string | null;
  backend: string;
}

export interface ComponentSignature {
  alg: string;
  public_key: string;
  signature: string;
  key_fingerprint: string;
}

export interface HybridSignature {
  signer: string;
  message_sha256: string;
  components: ComponentSignature[];
}

export interface Allocation {
  shipment_id: string;
  report_id: string;
  importer_id: string;
  tonnes: number;
  receipt: TxReceipt;
}

export interface Report {
  id: string;
  plant_id: string;
  period: string;
  sector: string;
  inputs: CementInputs;
  result: EmissionsResult;
  guard: GuardResult;
  status: ReportStatus;
  header: Record<string, unknown> | null;
  report_hash: string | null;
  plant_signature: HybridSignature | null;
  verifier_signature: HybridSignature | null;
  verifier_note: string | null;
  receipts: Record<string, TxReceipt>;
  created_at: string;
  signature_bytes?: Record<string, number>;
  remaining_tonnes?: number;
  allocations?: Allocation[];
  leaves?: { total: number; disclosable: number; private: number };
}

export interface Plant {
  id: string;
  name: string;
  city: string;
  sector: string;
  key_fingerprint: string | null;
}

export interface Importer {
  id: string;
  name: string;
  port: string;
}

export interface Info {
  chain: { backend: string; label: string; address: string | null; explorer: string | null };
  verifier: { name: string; key_fingerprint: string };
  live_period: string;
  importers: Importer[];
}

export interface CostLine {
  basis: string;
  see_tco2_per_t: number;
  benchmark_deduction_tco2_per_t: number;
  obligation_tco2: number;
  gross_cost_eur: number;
  carbon_price_deduction_eur: number;
  net_cost_eur: number;
}

export interface CostComparison {
  sector: string;
  year: number;
  tonnes: number;
  certificate_price_eur: number;
  default: CostLine;
  verified: CostLine;
  saving_eur: number;
  assumptions: string[];
}

export interface Disclosure {
  field: string;
  value: unknown;
  salt: string;
  proof: { sibling: string; side: "left" | "right" }[];
  root: string;
}

export interface DisclosurePackage {
  shipment_id: string;
  plant_name: string;
  product: string;
  private_field_groups: Record<string, number>;
  importer_id: string;
  tonnes: number;
  header: Record<string, unknown>;
  report_hash: string;
  disclosures: Disclosure[];
  plant_signature: HybridSignature;
  verifier_signature: HybridSignature;
  receipts: Record<string, TxReceipt>;
  cost: CostComparison;
  carbon_price_paid_eur: number;
}

export interface ChainEvent {
  event: string;
  block: number;
  tx_hash: string;
  [k: string]: unknown;
}
