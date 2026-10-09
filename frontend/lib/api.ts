// Typed client for the FastAPI backend (proxied at /api by next.config.mjs).
import type {
  Allocation, CementInputs, ChainEvent, CostComparison, DisclosurePackage, EmissionsResult,
  Info, Plant, Report,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public detail?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.code ?? "error", body.message ?? res.statusText, body.detail);
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

export const api = {
  info: () => request<Info>("/info"),
  plants: () => request<Plant[]>("/plants"),
  plantReports: (plantId: string) => request<Report[]>(`/plants/${plantId}/reports`),
  report: (id: string) => request<Report>(`/reports/${encodeURIComponent(id)}`),

  scenarioKinds: () => request<string[]>("/demo/scenarios"),
  scenario: (plantId: string, kind: string) =>
    request<{ period: string; inputs: CementInputs }>(`/demo/scenarios/${plantId}?kind=${kind}`),
  reset: () => post<{ ok: boolean }>("/demo/reset"),

  preview: (plantId: string, period: string, inputs: CementInputs) =>
    post<EmissionsResult>(`/plants/${plantId}/preview`, { period, inputs }),
  submit: (plantId: string, period: string, inputs: CementInputs) =>
    post<Report>(`/plants/${plantId}/reports`, { period, inputs }),
  sign: (id: string) => post<Report>(`/reports/${encodeURIComponent(id)}/sign`),
  cosign: (id: string, note?: string) => post<Report>(`/reports/${encodeURIComponent(id)}/cosign`, { note }),
  allocate: (id: string, shipment_id: string, importer_id: string, tonnes: number) =>
    post<{ allocation: Allocation; remaining_tonnes: number }>(
      `/reports/${encodeURIComponent(id)}/allocations`, { shipment_id, importer_id, tonnes }),

  verifierQueue: () => request<Report[]>("/verifier/queue"),
  disclosure: (shipmentId: string) => request<DisclosurePackage>(`/shipments/${encodeURIComponent(shipmentId)}/disclosure`),
  verifyOnServer: (pkg: DisclosurePackage) => post<{ valid: boolean }>("/disclosure/verify", pkg),
  costSchedule: (tonnes: number, see: number, carbonPaid: number) =>
    request<CostComparison[]>(`/cost/schedule?tonnes=${tonnes}&see=${see}&carbon_paid_eur=${carbonPaid}`),

  audit: () => request<{
    chain: string; events: ChainEvent[]; allocations: Allocation[];
    reports: { id: string; status: string; report_hash: string | null; guard: string; see_total: number }[];
  }>("/audit"),
};

export const reportId = (plantId: string, period: string) => `${plantId}:${period}`;
