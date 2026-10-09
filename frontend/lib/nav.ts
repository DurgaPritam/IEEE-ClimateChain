// Roles and their tabs (from the TopBar design). Add a screen by adding a route + one entry here.

export type Role = "plant" | "verifier" | "importer" | "regulator";

export const ROLES: { id: Role; label: string; home: string }[] = [
  { id: "plant", label: "Plant operator", home: "/plant/submit" },
  { id: "verifier", label: "Verifier", home: "/verifier" },
  { id: "importer", label: "EU importer", home: "/importer" },
  { id: "regulator", label: "Regulator", home: "/regulator" },
];

export const TABS: Record<Role, { href: string; label: string }[]> = {
  plant: [
    { href: "/plant/submit", label: "Submit month" },
    { href: "/plant/report", label: "Report" },
    { href: "/plant/sign", label: "Sign & anchor" },
    { href: "/plant/allocate", label: "Allocate tonnes" },
    { href: "/plant/history", label: "History" },
  ],
  verifier: [{ href: "/verifier", label: "Review queue" }],
  importer: [{ href: "/importer", label: "Shipments" }],
  regulator: [{ href: "/regulator", label: "Audit trail" }],
};

export const roleOf = (path: string): Role =>
  (ROLES.find((r) => path.startsWith("/" + r.id))?.id ?? "plant");
