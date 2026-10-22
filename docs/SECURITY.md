# Security and data integrity assessment

This document covers what VERDANT-X protects, against whom, and where the protection stops. It describes the prototype as it is in this repository. Where the demo takes a shortcut, it says so.

## 1. Assets

| Asset | Why it matters | Where it lives |
|---|---|---|
| Verified emissions intensity (SEE) | Sets the importer's CBAM bill | Report store; disclosed via Merkle proof |
| Private process data (fuel mix, clinker chemistry, electricity, volumes) | Commercially confidential | Off-chain store only, committed in the Merkle tree |
| Merkle salts | Keep private leaves from being guessed | Off-chain store; never returned by `/reports` |
| Verified tonnage and allocations | One green tonne must be claimed once | `VerdantRegistry` (`verifiedKg`, `allocatedKg`, `shipmentUsed`) |
| Signing keys (plant, verifier) | Authenticate reports | Demo: memory or `backend/keys/`; production: HSM/KMS |
| Wallet keys (owner/operator, verifier) | Authorise contract calls | `.env` (test wallets only) |
| Audit trail | Regulator and dispute evidence | Contract events; refused attempts in the off-chain store; `/audit` |

## 2. Actors and trust assumptions

| Actor | Trusted for | Not trusted for |
|---|---|---|
| Plant operator | Running its own installation | Honest numbers, selling tonnes once |
| Accredited verifier | Reviewing evidence, often on site | Being independent of the plant without checks |
| Registry owner (multisig in production) | Allow-listing installations and verifiers | Report content |
| Importer | Nothing beyond its own purchase | – |
| VERDANT-X server | Running the calculation and guard | Delivering unaltered data to the importer |
| Blockchain | Ordering, immutability, enforcing contract rules | The truth of the data |

Assumptions: SHA-256 is collision resistant; at least one of ML-DSA-65 and ECDSA P-256 is unforgeable; the owner key is not compromised; the verifier does its job.

## 3. Threat model

| # | Attacker | Attack | Control | Where in code | Residual risk |
|---|---|---|---|---|---|
| T1 | Plant | Understates process CO₂ or CaO | Calcination floor and clinker chemistry rules block | `guard/rules/cement.py` `CalcinationFloor`, `ClinkerChemistry` | Plant could fake a consistent set of numbers inside all bands; verifier must check |
| T2 | Plant | Hides fuel | Kiln energy band blocks below 2.9 GJ/t clinker | `KilnEnergyBand` | Fuel hidden while staying inside the band |
| T3 | Plant | Inflates cement output or hides clinker | Mass balance and clinker-ratio rules block | `MassBalance`, `ClinkerRatio` | Coordinated misreport of clinker and additives |
| T4 | Plant | Drops electricity (indirect emissions) | Electricity band vs own history warns; anomaly model warns | `ElectricityBand`, `guard/anomaly.py` | Warn only (0/36 blocked in `make eval`); depends on the verifier acting on it |
| T5 | Plant | Overnight "green" claim | Sudden-improvement rule warns without a declared change | `SuddenImprovement` | A false declaration passes the rule |
| T6 | Plant | Signs a blocked report | Service refuses to sign `blocked` reports | `service.py` `plant_sign` | Server enforces it, not the chain |
| T7 | Plant | Two reports for one month | One report per installation and period | `anchorReport` → `PeriodAlreadyReported`; `submit` accepts only `YYYY-MM` | The contract itself still takes a free string, so another client could anchor `2026-6`; a numeric period on-chain would close this |
| T8 | Plant | Sells the same verified tonne twice | Running total, per-shipment flag | `allocate` → `OverAllocation`, `ShipmentAlreadyAllocated` | Allocation outside VERDANT-X (paper certificates) is not seen |
| T9 | Plant | Allocates before verification | Status check | `allocate` → `NotVerified` | – |
| T10 | Plant | Edits data after signing | Report hash, Merkle root and both signatures change | `trust/merkle.py`, `trust/signatures/hybrid.py` | – |
| T11 | Plant | Co-signs its own report | Verifier allow-list; verifier ≠ operator | `coSign` → `NotVerifier`, `VerifierIsOperator` | A verifier using a separate wallet but colluding with the plant |
| T12 | Verifier | Rubber-stamps | Its key fingerprint is recorded on-chain per report | `ReportCoSigned` event | Accountability after the fact, not prevention |
| T13 | Outsider | Calls contract admin or flow functions | `onlyOwner`, operator and verifier checks | `VerdantRegistry.sol` | Owner key compromise (use multisig) |
| T14 | Server / MITM | Changes a disclosed value | Browser recomputes Merkle proof, report hash, both signatures | `frontend/lib/verify.ts` | See T15 |
| T15 | Server / MITM | Replaces the whole package with self-made keys and header | Plant key must match header fingerprint | `verify.ts` `keyMatchesHeader`; `onchain.ts` reads `reports(hash)` and `shipmentUsed` from a public RPC: status `Verified`, Merkle root, plant and verifier key fingerprints must match | The importer must confirm the registry address out of band (it is shown on the page and published in the README); in the offline demo chain there is nothing to read |
| T16 | Importer | Guesses private values from the root or proofs | 32-byte random salt per leaf | `merkle.py` | – |
| T17 | Quantum adversary | Forges ECDSA signatures | ML-DSA-65 component must also verify | `hybrid.verify`, `verifyHybrid` | – |
| T18 | Attacker | Strips one signature component (downgrade) | Required scheme set must match exactly | `hybrid.verify` | Operator can set `SIGNATURE_SCHEMES` to ECDSA only (emergency mode, labelled) |
| T19 | Attacker | Replays a signature in another context | Domain prefix `VERDANT-X/report-signature/v1` | `hybrid.py`, `verify.ts` | – |
| T20 | Anyone on the network | Calls plant or verifier API endpoints | **None in the demo.** No authentication, CORS `*` | `main.py`, `api/routes.py` | Must add authentication and role checks before production |
| T21 | Insider at server | Reads private data or keys | Demo keys file mode `0600`, gitignored | `trust/keystore.py` | Server holds plant and verifier keys in the demo; production keys belong with each party |

## 4. Data integrity: proven vs attested

**What the system proves** (anyone can check with public data and math):

- The disclosed values belong to the committed report (Merkle proof against the signed root).
- The header was signed by the holder of the plant key, and by a second key, with both ML-DSA-65 and ECDSA P-256.
- The header has not changed since signing (report hash).
- On-chain: a report hash was anchored once per installation and period, co-signed by an allow-listed verifier that is not the operator, and allocated no more than its verified tonnage.

**What the system only attests** (someone vouches for it):

- That the plant's numbers describe what really happened. The guard checks plausibility, and the verifier reviews evidence. Neither proves the truth.
- That the emission factors are right. They come from `config/cement.yaml`, with sources; some are still marked `verify`.
- That the verifier is accredited. The owner allow-lists it; accreditation happens outside the system.
- The cost comparison. It is computed on the server, because it uses the private clinker ratio.

**The chain does not make data true.** It makes records tamper-evident, gives every party the same order of events, and enforces allocation limits across importers who never talk to each other.

## 5. Privacy

| The importer sees | Stays private |
|---|---|
| `see_total`, `see_direct`, `see_indirect`, `cn_code`, `period`, `plant_id` (with salts and proofs) | All `input.*` fields: fuels, CaO/MgO, electricity, clinker and additive volumes, carbon price evidence |
| Signed header: `product_t`, `sector`, Merkle root, plant key fingerprint | All `calc.*` breakdown values |
| Both hybrid signatures and public keys | `guard.status` |
| Transaction receipts, allocated tonnes, cost comparison | Salts of undisclosed leaves |
| Number of private leaves per group | Their values |

On-chain data is public but holds only hashes, fingerprints, the period string and kg amounts. Monthly output in kg is visible on-chain; a plant that treats volume as confidential would need it removed or bucketed.

Salting: each leaf has its own 32-byte random salt. Without it, an importer could hash candidate values (for example CaO from 0.600 to 0.690 in steps of 0.001) and compare. `test_merkle_root_hides_values_via_salt` checks that the same data gives different roots.

## 6. Why post-quantum

CBAM declarations back financial and legal claims that can be audited years later. A signature made today must still hold when a large quantum computer may forge ECDSA. ML-DSA-65 is NIST FIPS 204. The hybrid rule keeps ECDSA as well, so the report stays secure if either scheme turns out to be broken. The browser verifies with `@noble/post-quantum` and `@noble/curves`, independent of the backend's liboqs and `cryptography`, which cross-checks the implementations.

ML-DSA is not verified on-chain: it is too expensive today. The chain stores the hybrid key fingerprints instead.

## 7. Key management

| | Demo (this repo) | Production |
|---|---|---|
| Signing keys | Generated in memory at start-up (memory chain), or stored unencrypted in `backend/keys/` with mode `0600` when a real chain needs stable fingerprints | One HSM/KMS key set per installation and per verifier, held by that party |
| Who signs | The server signs for plants and the verifier | Each party signs on its own infrastructure; the server only collects signatures |
| Wallets | One deployer wallet is owner and operator of every demo plant; a second wallet is the verifier (`.env`, test keys only) | Owner is a multisig; each operator and verifier has its own wallet |
| Rotation | Not implemented | `registerInstallation` / `setVerifier` with a new fingerprint; old reports keep the fingerprint they were signed with |

## 8. Smart-contract security notes

- **Access control.** `onlyOwner` on `registerInstallation` and `setVerifier`. `anchorReport` and `allocate` require the installation's operator. `coSign` requires an active verifier that is not the operator.
- **Custom errors.** 13 custom errors, all with clear names; `OverAllocation` and `PeriodAlreadyReported` carry arguments. The backend decodes them by selector (`web3_client.py`) and dry-runs each call before sending, so a revert costs no gas.
- **No funds.** No `payable` function, no `receive` or `fallback`. The contract holds no value.
- **Reentrancy.** Not applicable: the contract makes no external calls.
- **Arithmetic.** Solidity 0.8 checked arithmetic. `allocatedKg` can never exceed `verifiedKg`.
- **State machine.** None → Pending → Verified, enforced by `NotPending` and `NotVerified`.
- **Events.** Every state change emits an event.
- **Owner power.** `registerInstallation` can overwrite an existing installation, including its operator. In production this belongs to a multisig with a delay.
- **Period format.** `submit` accepts only `YYYY-MM` (tested), but the contract takes a free string. A numeric period on-chain would close the gap for other clients.
- **Verified source.** [Polygonscan, Amoy](https://amoy.polygonscan.com/address/0xdA8D576790524F96Ee6DFC5365C8aF6Be33d4230#code).

## 9. Known limitations and residual risks

- No authentication or authorisation on the API (T20). The UI's roles are a demo convenience.
- The server holds the plant's and the verifier's signing keys (T21).
- The browser reads the registry itself (T15), but it trusts the RPC endpoint and the registry address it is given. The importer should confirm the address against the published one; a production version would let the importer choose the RPC.
- The off-chain store is in-memory. Salts are lost on restart, so earlier reports cannot be disclosed again.
- The guard is tuned on synthetic data. The fraud types were written together with the rules, so rule results are optimistic.
- Selective disclosure uses Merkle proofs, not zero-knowledge proofs. The importer sees exact values of disclosed fields.
- Allocation is only enforced inside VERDANT-X. The EU CBAM Registry is still the legal record.
- The memory chain mirrors the contract's report and allocation rules, but not its caller checks (operator, owner, verifier ≠ operator), because it runs in one process.

## 10. Test evidence

`make test` runs both suites. Last run: **32 backend tests passed, 9 contract tests passed.**

| Test | What it shows |
|---|---|
| `backend/tests/test_trust.py` | Canonical JSON is order-independent; hybrid sign/verify; tampered report fails; a missing component fails; one broken component fails; Merkle proofs round-trip for 1, 2, 3, 5, 8 leaves; changed value fails; salts hide values |
| `backend/tests/test_guard.py` | Every injected fraud at Marmara is blocked; honest plants are never blocked; every flag has a reason; anomaly flags carry SHAP contributions and are warnings |
| `backend/tests/test_flow.py` | Full HTTP flow: submit, sign, co-sign, allocate, disclose, verify; a tampered disclosure fails; selling the same tonnes again returns 409 `chain:OverAllocation`; an under-reporting plant is blocked and cannot sign; the audit trail lists chain events and keeps refused attempts (`OverAllocation`, guard blocks) |
| `backend/tests/test_emissions.py` | Hand-worked example; biomass is zero-rated; a reported process CO₂ figure never lowers calcination |
| `backend/tests/test_pricing.py` | Verified is cheaper than default; obligation never negative; carbon-price deduction capped; phase-out raises cost; mark-up per year; benchmark scales with clinker ratio |
| `contracts/test/VerdantRegistry.test.js` | Only the owner administers; anchoring, period uniqueness, non-operators rejected; co-sign by allow-listed verifier once; strangers, revoked verifiers and the operator rejected; over-allocation across importers rejected; unverified reports, reused shipments, zero amounts and strangers rejected |

**Guard evaluation** (`make eval`, synthetic data, 6 fraud types × 36 plant-months):

| | Result |
|---|---|
| Anomaly model alone | 100/216 (46%) |
| Rules block | 175/216 (81%) |
| Caught by any check (block or warn) | 216/216 |
| Honest months: false alarms (anomaly) | 3/36 |
| Honest months: wrongly blocked | 0/36 |
