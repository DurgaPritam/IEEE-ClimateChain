// Number and label formatting shared by all screens (tabular, en-US grouping, units stated).

export const num = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const eur = (n: number) => "€" + num(Math.round(n));
export const tonnes = (n: number, digits = 1) => `${num(n, digits)} t`;
export const intensity = (n: number) => n.toFixed(3);

/** "0x3f9a…c21e": first 4 + last 4 hex after 0x, as in the design system. */
export const shortHash = (h: string) => {
  const full = h.startsWith("0x") ? h : "0x" + h;
  return full.length > 14 ? `${full.slice(0, 6)}…${full.slice(-4)}` : full;
};

/** Backend strings use ASCII ("CO2", ">=", "->"); show proper typography. */
export const pretty = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/CO2/g, "CO₂")
    .replace(/>=/g, "≥")
    .replace(/<=/g, "≤")
    .replace(/ -> /g, " → ")
    .replace(/ - /g, " – ")
    .replace(/CEM_([IV]+)(?:_([A-C]))?/g, (_, a, b) => `CEM ${a}${b ? "/" + b : ""}`);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const periodLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export const cementTypeLabel = (t: string) => t.replace("CEM_", "CEM ").replace(/_/g, "/");

export const FUEL_LABELS: Record<string, string> = {
  petcoke: "Petcoke", coal: "Coal", lignite: "Lignite", natural_gas: "Natural gas",
  fuel_oil: "Fuel oil", waste_tyres: "Waste tyres", biomass: "Biomass",
};

export const SCENARIO_LABELS: Record<string, string> = {
  honest: "Honest month",
  calcination_floor: "Fraud · calcination below chemistry",
  low_cao: "Fraud · low CaO",
  hidden_fuel: "Fraud · hidden fuel",
  inflated_output: "Fraud · inflated output",
  missing_electricity: "Fraud · missing electricity",
  sudden_drop: "Fraud · sudden drop",
};

export const SCENARIO_NOTES: Record<string, string> = {
  honest: "Synthetic profile for this plant, live month. Values from published ranges.",
  calcination_floor: "Process CO₂ reported 20% below what the clinker chemistry requires.",
  low_cao: "Clinker CaO set to 0.48, outside the Portland range.",
  hidden_fuel: "All fuel quantities reduced by 30%.",
  inflated_output: "Cement output raised 12% with no extra clinker or additives.",
  missing_electricity: "Kiln and grinding electricity halved.",
  sudden_drop: "Fuel cut 22% and CaO lowered with no declared process change.",
};
