# VERDANT-X

**Every tonne of embedded carbon. Verified, private, and quantum-safe.**

Submission to the IEEE ClimateChain Global Hackathon, track **Carbon Markets & Emissions Transparency**.

Since 1 January 2026, EU importers of cement owe CBAM certificates for the carbon embedded in those goods. They can use a supplier's verified actual emissions, or EU default values that are deliberately high. VERDANT-X lets a Turkish cement plant prove its real emissions to EU importers without handing over confidential process data:

1. **Calculates** embedded emissions with the CBAM method for cement (clinker as precursor).
2. **Checks** the data against chemistry, physics and the plant's own history before anything is recorded. Every flag has a plain-language reason.
3. **Signs** every report with hybrid post-quantum **ML-DSA-65 (FIPS 204)** + **ECDSA P-256** signatures.
4. **Anchors** a fingerprint on-chain and **stops over-allocation**: the same verified tonne cannot be sold to two importers.
5. **Discloses selectively**: the importer receives the emissions intensity and a Merkle proof. Recipes, fuel mix and energy contracts stay private.

> All plant data in this repository is **synthetic**, built from published ranges. No real plant was involved.

**Climate impact.** On EU default values, a cement plant that cuts its emissions pays exactly the same at the border, so each tonne of CO₂ cut is worth €0. With verified data, each tonne cut is worth about €77. VERDANT-X makes that verified data cheap to produce, confidential, and safe from **double counting**. See [docs/CLIMATE_IMPACT.md](docs/CLIMATE_IMPACT.md) for sourced figures and projections.

## Submission documents

- [Problem statement and solution overview](docs/PROBLEM_STATEMENT.md): the CBAM default-value problem and VERDANT-X in five steps (2 pages).
- [Climate impact assessment](docs/CLIMATE_IMPACT.md): sourced figures, synthetic-plant costs and CO₂ projections.
- [Architecture and technical specification](docs/ARCHITECTURE.md): component and sequence diagrams, data model, contract, API and crypto parameters.
- [Security and data integrity assessment](docs/SECURITY.md): threat model, what is proven vs attested, privacy, key management and test evidence.
- [Implementation, adoption and scalability roadmap](docs/ROADMAP.md): who pays, pilot plan, production needs, other sectors and measured gas costs.

## Quick start

```bash
brew install liboqs          # Open Quantum Safe C library (or use the OQS Docker image)
make setup                   # Python venv + npm install
make test                    # backend (pytest) + contract (Hardhat) tests
make api                     # seeded demo API -> http://localhost:8000/docs
make web                     # web app -> http://localhost:3000 (second terminal)
```

`make demo` runs both on the offline in-memory chain. To run on Polygon Amoy instead, fill in `.env` (see below) and run `make api` with `CHAIN_BACKEND=web3`.

By default the backend uses an in-memory chain that enforces the same rules as the contract. To use a real chain, copy `.env.example` to `.env`, then:

```bash
make node & make deploy-local        # local Hardhat chain
CHAIN_BACKEND=web3 CHAIN_NETWORK=localhost make api
# or: fill DEPLOYER/VERIFIER keys + RPC in .env, `make deploy-amoy`, CHAIN_NETWORK=amoy
```

## Repository layout

```
backend/app/
  config/          cement.yaml, pricing.yaml — every factor, threshold and source (no numbers in code)
  sectors/         Sector interface + cement engine; register new sectors in sectors/__init__.py
  guard/           plausibility guard: rules/cement.py (one class per rule) + anomaly.py (Isolation Forest + SHAP)
  trust/           canonical JSON (RFC 8785), signatures/ (ML-DSA, ECDSA, hybrid), merkle.py
  chain/           ChainClient interface: memory.py (offline) and web3_client.py (testnet)
  pricing/         CBAM cost: default values vs verified, minus carbon price paid in Turkey
  service.py       the end-to-end flow, independent of the web layer
  api/routes.py    HTTP API grouped by role (plant, verifier, importer, regulator, demo)
  data/synthetic.py  3 plants × 24 months with labelled injected frauds
backend/scripts/   evaluate_guard.py: detection rates on injected frauds (`make eval`)
contracts/         VerdantRegistry.sol, tests, deploy script
frontend/          Next.js + Tailwind app (design tokens from Claude Design, dark first)
  app/(app)/       role screens: plant/{submit,report,sign,allocate,history}, verifier, importer, regulator
  app/(public)/d/  importer disclosure link (no login) + CBAM cost comparison (3 layouts)
  app/story/       full-screen fraud moments for the video, driven by live data
  lib/verify.ts    in-browser verification: ML-DSA-65 + ECDSA (@noble), RFC 8785, Merkle proofs
```

**Extending.** To add steel, implement `Sector` in `sectors/steel.py`, add `config/steel.yaml`, add a rule list in `guard/rules/steel.py`, and register all three. The trust layer, chain and API stay unchanged. Signature schemes are selected by `SIGNATURE_SCHEMES`. Chain backends are selected by `CHAIN_BACKEND`.

## Flow

```
plant submits month ─► emissions engine ─► plausibility guard ──blocked──► back to plant
                                              │ pass / flagged
                                              ▼
                        plant hybrid-signs header (contains Merkle root) ─► anchorReport (pending)
                                              ▼
                        verifier reviews flags + evidence, hybrid co-signs ─► coSign (verified)
                                              ▼
                        plant allocates tonnes to shipments ─► allocate (reverts on over-allocation)
                                              ▼
                        importer opens disclosure package: intensity + Merkle proof + both signatures
                        + on-chain receipts + CBAM cost comparison; verifies everything client-side
```

## Emissions method (cement)

```
E_clinker  = m_clk (0.785 w_CaO + 1.092 w_MgO) + Σ_f Q_f · NCV_f · EF_f · (1 − biomass_f) + P_kiln · EF_grid
SEE_cement = r_clk · E_clinker / m_clk + P_grind · EF_grid / m_cem
```

Factors and their sources are listed in [backend/app/config/cement.yaml](backend/app/config/cement.yaml). EU default values and CBAM benchmarks come from Implementing Regulations (EU) 2025/2621 (as corrected by 2026/1740) and 2025/2620. Entries still marked `verify: true` have not been checked against an official source yet. Known simplifications:
- Calcination is computed with the clinker-output method. A reported raw-meal figure can raise process CO2 but never lower it.
- Non-carbonate CaO, bypass dust and drying fuels at the grinding stage are not modelled.
- The free-allocation adjustment is applied to total SEE, for both the default and verified paths alike.

## Plausibility checks

| Rule | Check | Catches | Severity |
|---|---|---|---|
| Clinker chemistry | CaO 0.60–0.69, MgO 0.005–0.05 | Understated calcination | block / warn |
| Calcination floor | Reported process CO2 ≥ stoichiometric minimum − 2% | Under-reported process emissions | block |
| Kiln energy band | 2.9–4.5 GJ/t clinker | Hidden fuel | block (low) / warn (high) |
| Clinker ratio | Within the band for the declared cement type | Hidden clinker, inflated output | block |
| Mass balance | Cement ≤ (clinker + additives) × 1.03 | Invented production | block |
| Electricity band | Plant history ± 3σ (industry range until 12 months exist) | Missing indirect emissions | warn |
| Sudden improvement | > 15% month-on-month drop without a declared change | Overnight green claims | warn |
| Anomaly model | Isolation Forest; SHAP names the driving features | Combinations no rule catches | warn (human review) |

The guard never accuses anyone automatically: a block returns the data to the plant, and a warning goes to the verifier.

**Measured detection** (`make eval`). Each plant's anomaly model is trained on 12 honest months. Every fraud type is then injected into each of the next 12 months (3 plants × 12 months = 36 cases per type):

| Injected fraud | Anomaly model alone | Rules block | Caught by any check |
|---|---|---|---|
| Understated calcination | 3/36 | 36/36 | 36/36 |
| Low CaO | 12/36 | 36/36 | 36/36 |
| Hidden fuel | 23/36 | 36/36 | 36/36 |
| Inflated output | 19/36 | 36/36 | 36/36 |
| Missing electricity | 7/36 | 0/36 (warned) | 36/36 |
| Sudden improvement | 36/36 | 31/36 | 36/36 |
| **All** | **100/216 (46%)** | **175/216 (81%)** | **216/216** |

On the honest copies of the same 36 months, the anomaly model raises 3 false alarms (8%) and no month is blocked.

Read these numbers with care. The data is synthetic, and the fraud types were written together with the rules, so the rule results are optimistic. A real plant's data will be noisier. The anomaly model on its own catches fewer than half of the frauds. It is a second layer for unusual combinations, not the main defence, and its warnings always go to a human verifier.

## Cryptography

- **ML-DSA-65** (NIST FIPS 204) through liboqs 0.16 / liboqs-python 0.16. Public key 1,952 B, signature 3,309 B.
- **ECDSA P-256 / SHA-256** through `cryptography`.
- **Hybrid rule:** a signature is valid only if *both* components verify and both are present, so it stays secure if either scheme is broken. Signatures are domain-separated (`VERDANT-X/report-signature/v1`).
- **Why post-quantum now:** CBAM declarations underpin financial and legal claims that are audited years later.
- **What is signed:** the canonical JSON (RFC 8785) report header: schema, plant, period, product tonnes, Merkle root, and the plant key fingerprint.
- **Merkle commitment:** salted leaves `H(0x00‖salt‖jcs({k,v}))` and internal nodes `H(0x01‖l‖r)`.
- **Off-chain verification:** PQ signatures are verified off-chain. On-chain ML-DSA verification is too expensive today, so the chain stores only fingerprints.
- **Key handling:** demo keys are generated in memory at startup. In production they belong in an HSM or KMS, one per installation and per verifier.

## Importer verification in the browser

The disclosure page does not trust the VERDANT-X server. `frontend/lib/verify.ts` re-checks everything locally with audited `@noble` libraries:
- the report hash, recomputed from the RFC 8785 canonical header
- **both** hybrid signatures: ML-DSA-65 (FIPS 204) and ECDSA P-256
- the plant key fingerprint against the header
- every disclosed field's Merkle proof

The backend signs with liboqs and `cryptography`, and the browser verifies with `@noble/post-quantum` and `@noble/curves`. These are independent implementations, so they double as a cross-check of the standards. Changing one disclosed value or one header byte makes the verification fail.

## Smart contract

`VerdantRegistry.sol` has these functions:
- `registerInstallation` and `setVerifier`: owner only (a multisig in production)
- `anchorReport`: one report per installation and period
- `coSign`: an allow-listed verifier, never the plant's own operator
- `allocate`: reverts with `OverAllocation(available, requested)`
- `remainingKg`

Every state change emits an event for the audit trail.

**Deployed on Polygon Amoy testnet:** [`0xdA8D576790524F96Ee6DFC5365C8aF6Be33d4230`](https://amoy.polygonscan.com/address/0xdA8D576790524F96Ee6DFC5365C8aF6Be33d4230). The source is published and verified: [read the contract on Polygonscan](https://amoy.polygonscan.com/address/0xdA8D576790524F96Ee6DFC5365C8aF6Be33d4230#code). The address and ABI are in [contracts/deployments/amoy.json](contracts/deployments/amoy.json). To publish a fresh deployment, run `npx hardhat verify --network amoy <address>` with `ETHERSCAN_API_KEY` set. Set `CHAIN_NAMESPACE` to rehearse with fresh on-chain plant IDs without redeploying. Transactions use a 30 gwei tip (`GAS_TIP_GWEI`).

## Why blockchain?

No single party — the plant, the verifier, an importer in another country, or customs — is trusted by all the others to run a shared database. Allocation limits must also hold across importers who never talk to each other. The chain makes records tamper-evident and enforces those limits. **It does not make data true.** That is the job of the plausibility guard and the accredited verifier.

## Threat model (summary)

| Who | Attack | Stopped by |
|---|---|---|
| Plant | Understates emissions | Guard (chemistry, physics, history) + verifier co-signature |
| Plant | Sells the same verified tonne twice | `allocate` limit on-chain |
| Plant | Files a second report for the same month | `PeriodAlreadyReported` |
| Plant | Edits data after signing | Report hash, signatures and Merkle root all change |
| Verifier | Rubber-stamps own plant's report | `VerifierIsOperator`, allow-list, accountability via key fingerprint |
| Server/MITM | Alters the intensity sent to the importer | Importer verifies Merkle proof + both hybrid signatures locally |
| Future quantum adversary | Forges ECDSA | ML-DSA component must also verify |

## Limitations

- Plant data is synthetic.
- The emissions method is simplified. The default values, benchmarks and certificate price come from official sources (see `config/`). The grid factor and the waste-tyre biomass share are still marked `verify`.
- The certificate price is held constant at the mean of the published 2026 quarters, and later years use the same price.
- Türkiye's ETS has no allowance price in 2026, so no carbon price paid at origin is deducted. The deduction logic exists for when a price appears.
- Selective disclosure uses Merkle proofs, not zero-knowledge proofs; a ZK version is future work.
- The off-chain store is in-memory for the demo.
- VERDANT-X supports accredited verifiers and the EU CBAM registry. It does not replace them.

## License

MIT
