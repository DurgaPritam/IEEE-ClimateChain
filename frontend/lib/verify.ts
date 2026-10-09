// Client-side verification of a disclosure package — mirrors backend/app/trust exactly,
// so the importer does not have to trust the VERDANT-X server.
//   - report hash   = sha256(RFC 8785 canonical JSON of the signed header)
//   - hybrid sig    = ML-DSA-65 (FIPS 204) AND ECDSA P-256/SHA-256, over DOMAIN || header bytes
//   - Merkle leaves = sha256(0x00 || salt || jcs({k, v})), nodes = sha256(0x01 || left || right)
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import canonicalize from "canonicalize";
import type { DisclosurePackage, HybridSignature, Disclosure } from "./types";

const DOMAIN = new TextEncoder().encode("VERDANT-X/report-signature/v1\x00");
const REQUIRED = ["ML-DSA-65", "ECDSA-P256-SHA256"];

const enc = (s: string) => new TextEncoder().encode(s);
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

export const canonicalBytes = (obj: unknown) => enc(canonicalize(obj) ?? "");

function verifyComponent(alg: string, msg: Uint8Array, sig: Uint8Array, pk: Uint8Array): boolean {
  try {
    if (alg === "ML-DSA-65") return ml_dsa65.verify(sig, msg, pk);
    if (alg === "ECDSA-P256-SHA256") return p256.verify(sig, msg, pk, { format: "der", lowS: false, prehash: true });
  } catch {
    return false;
  }
  return false;
}

export function verifyHybrid(header: unknown, sig: HybridSignature): { valid: boolean; components: Record<string, boolean> } {
  const msg = concat(DOMAIN, canonicalBytes(header));
  const components: Record<string, boolean> = {};
  for (const c of sig.components) components[c.alg] = verifyComponent(c.alg, msg, b64(c.signature), b64(c.public_key));
  const present = sig.components.map((c) => c.alg).sort().join();
  const valid = present === [...REQUIRED].sort().join() && Object.values(components).every(Boolean);
  return { valid, components };
}

/** sha256 over the concatenated per-component key fingerprints — the identity anchored on-chain. */
export function hybridKeyFingerprint(sig: HybridSignature): string {
  return toHex(sha256(concat(...sig.components.map((c) => fromHex(c.key_fingerprint)))));
}

export function verifyDisclosure(d: Disclosure, root: string): boolean {
  let h = sha256(concat(new Uint8Array([0]), fromHex(d.salt), canonicalBytes({ k: d.field, v: d.value })));
  for (const step of d.proof) {
    const s = fromHex(step.sibling);
    h = sha256(step.side === "left" ? concat(new Uint8Array([1]), s, h) : concat(new Uint8Array([1]), h, s));
  }
  return toHex(h) === root;
}

export interface ClientVerification {
  reportHash: boolean;
  plant: { valid: boolean; components: Record<string, boolean>; keyMatchesHeader: boolean };
  verifier: { valid: boolean; components: Record<string, boolean> };
  disclosures: Record<string, boolean>;
  valid: boolean;
}

export function verifyPackage(p: DisclosurePackage): ClientVerification {
  const root = String(p.header.merkle_root);
  const reportHash = toHex(sha256(canonicalBytes(p.header))) === p.report_hash;
  const plantSig = verifyHybrid(p.header, p.plant_signature);
  const keyMatchesHeader = hybridKeyFingerprint(p.plant_signature) === p.header.plant_key_fingerprint;
  const verifier = verifyHybrid(p.header, p.verifier_signature);
  const disclosures = Object.fromEntries(p.disclosures.map((d) => [d.field, verifyDisclosure(d, root)]));
  const valid = reportHash && plantSig.valid && keyMatchesHeader && verifier.valid && Object.values(disclosures).every(Boolean);
  return { reportHash, plant: { ...plantSig, keyMatchesHeader }, verifier, disclosures, valid };
}
