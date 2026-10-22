// Reads VerdantRegistry directly from a public RPC, so the importer's browser can compare a
// disclosure package with the chain instead of trusting the VERDANT-X server's receipts.
import { keccak_256 } from "@noble/hashes/sha3.js";
import type { DisclosurePackage } from "./types";
import { hybridKeyFingerprint } from "./verify";

const enc = (s: string) => new TextEncoder().encode(s);
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const selector = (sig: string) => toHex(keccak_256(enc(sig))).slice(0, 8);
const strip = (h: string) => h.toLowerCase().replace(/^0x/, "");

/** Same rule as the backend's b32(): 32-byte hex passes through, anything else is keccak-hashed. */
const b32 = (v: string) => (/^(0x)?[0-9a-fA-F]{64}$/.test(v) ? strip(v) : toHex(keccak_256(enc(v))));

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data: "0x" + data }, "latest"] }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return strip(body.result);
}

const STATUS = ["None", "Pending", "Verified"] as const;

export interface OnChainCheck {
  status: (typeof STATUS)[number];
  rootMatches: boolean;
  plantKeyMatches: boolean;
  verifierKeyMatches: boolean;
  shipmentRecorded: boolean;
  verifiedKg: bigint;
  allocatedKg: bigint;
  valid: boolean;
}

/** `namespace` mirrors the backend's CHAIN_NAMESPACE prefix for shipment ids ("" when unset). */
export async function checkOnChain(rpcUrl: string, registry: string, p: DisclosurePackage, namespace = ""): Promise<OnChainCheck> {
  // reports(bytes32) returns the struct's static fields in order, then the offset of `period`.
  const r = await ethCall(rpcUrl, registry, selector("reports(bytes32)") + b32(p.report_hash));
  const word = (i: number) => r.slice(i * 64, (i + 1) * 64);
  const used = await ethCall(rpcUrl, registry, selector("shipmentUsed(bytes32)") + b32(namespace ? `${namespace}/${p.shipment_id}` : p.shipment_id));

  const status = STATUS[Number(BigInt("0x" + (word(7) || "0")))] ?? "None";
  const out = {
    status,
    rootMatches: word(1) === b32(String(p.header.merkle_root)),
    plantKeyMatches: word(2) === b32(String(p.header.plant_key_fingerprint)),
    verifierKeyMatches: word(3) === b32(hybridKeyFingerprint(p.verifier_signature)),
    shipmentRecorded: BigInt("0x" + used) === 1n,
    verifiedKg: BigInt("0x" + (word(5) || "0")),
    allocatedKg: BigInt("0x" + (word(6) || "0")),
  };
  return { ...out, valid: status === "Verified" && out.rootMatches && out.plantKeyMatches && out.verifierKeyMatches && out.shipmentRecorded };
}
