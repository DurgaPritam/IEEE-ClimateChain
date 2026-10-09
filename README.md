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

## Quick start

```bash
brew install liboqs          # Open Quantum Safe C library (or use the OQS Docker image)
make setup                   # Python venv + npm install
make test                    # backend (pytest) + contract (Hardhat) tests
make api                     # seeded demo API -> http://localhost:8000/docs
```

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
contracts/         VerdantRegistry.sol, tests, deploy script
frontend/          Next.js app (in progress)
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

Factors and their sources are listed in [backend/app/config/cement.yaml](backend/app/config/cement.yaml). Entries marked `verify: true` must still be checked against Implementing Regulation (EU) 2025/2621. Known simplifications:
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

On the synthetic data, every injected fraud is blocked and no honest month is blocked (`tests/test_guard.py`). The guard never accuses anyone automatically: a block returns the data to the plant, and a warning goes to the verifier.

## Cryptography

- **ML-DSA-65** (NIST FIPS 204) through liboqs 0.16 / liboqs-python 0.16. Public key 1,952 B, signature 3,309 B.
- **ECDSA P-256 / SHA-256** through `cryptography`.
- **Hybrid rule:** a signature is valid only if *both* components verify and both are present, so it stays secure if either scheme is broken. Signatures are domain-separated (`VERDANT-X/report-signature/v1`).
- **Why post-quantum now:** CBAM declarations underpin financial and legal claims that are audited years later.
- **What is signed:** the canonical JSON (RFC 8785) report header: schema, plant, period, product tonnes, Merkle root, and the plant key fingerprint.
- **Merkle commitment:** salted leaves `H(0x00‖salt‖jcs({k,v}))` and internal nodes `H(0x01‖l‖r)`.
- **Off-chain verification:** PQ signatures are verified off-chain. On-chain ML-DSA verification is too expensive today, so the chain stores only fingerprints.
- **Key handling:** demo keys are generated in memory at startup. In production they belong in an HSM or KMS, one per installation and per verifier.

## Smart contract

`VerdantRegistry.sol` has these functions:
- `registerInstallation` and `setVerifier`: owner only (a multisig in production)
- `anchorReport`: one report per installation and period
- `coSign`: an allow-listed verifier, never the plant's own operator
- `allocate`: reverts with `OverAllocation(available, requested)`
- `remainingKg`

Every state change emits an event for the audit trail.

Deployed address and explorer link: *TBD (Polygon Amoy)*.

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
- The emissions method is simplified, and the factors marked `verify` must be checked against the EU implementing rules.
- The Turkish ETS deduction is simplified.
- Selective disclosure uses Merkle proofs, not zero-knowledge proofs; a ZK version is future work.
- The off-chain store is in-memory for the demo.
- VERDANT-X supports accredited verifiers and the EU CBAM registry. It does not replace them.

## License

MIT
