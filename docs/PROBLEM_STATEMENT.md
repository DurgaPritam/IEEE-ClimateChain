# Problem statement and solution overview

**VERDANT-X lets a cement plant outside the EU prove its real emissions to EU importers: verified, private, quantum-safe, and impossible to count twice.**

Track: Carbon Markets & Emissions Transparency.

## The problem

Since 1 January 2026, EU importers of cement must buy CBAM certificates for the CO₂ embedded in it. They can price a shipment in two ways:

- **EU default values.** Türkiye has no country-specific value, so grey cement is charged at **1.584 t CO₂/t in 2026**, rising to 1.728 in 2027 and 1.872 from 2028.
- **Verified actual emissions.** Turkish exporters report about **0.82 t CO₂/t cement**.

On default values, a plant that halves its emissions pays the same as one that does nothing. **Each tonne of CO₂ cut is worth €0 at the border.** Verified data is the only route by which decarbonisation shows up in the price.

That route has three problems today:

1. **It is slow.** Each report is checked by hand, and plant, verifier and importer share no common record.
2. **It exposes confidential data.** Backing up a number usually means sharing the recipe, fuel mix and energy data behind it.
3. **Nothing stops double counting.** One verified low-carbon tonne can be claimed by two importers who never talk to each other. Under-reported or double-counted tonnes break the carbon price signal.

## Who is affected

| Who | Impact |
|---|---|
| Exporting plants (Türkiye supplied 42.9% of EU cement and clinker imports in 2025, about 6.1 Mt) | Pay default-value prices or reveal confidential data; get no reward for cutting emissions |
| EU importers | Carry the CBAM bill and the legal risk if a supplier's figure is wrong |
| Accredited verifiers | Repeat manual checks, with no shared record of what they signed |
| Regulators and customs | Cannot see whether the same verified tonnes were declared twice |
| The climate | Real cuts are not rewarded, and false claims are not caught |

## The solution in five steps

1. **Calculate.** The plant enters one month of data. VERDANT-X computes embedded emissions with the CBAM method for cement, with clinker as a precursor. Every factor comes from a config file with its source.
2. **Check.** A plausibility guard tests the data against chemistry, physics and the plant's own history before anything is signed. Impossible data is blocked and returned to the plant. Unusual data is flagged for the verifier. Every flag has a plain-language reason.
3. **Sign.** The plant signs a report header with hybrid **ML-DSA-65 (FIPS 204) + ECDSA P-256** signatures. An accredited verifier reviews the flags and co-signs.
4. **Anchor and allocate.** A fingerprint of the report goes on-chain (Polygon). The plant assigns verified tonnes to shipments. The contract **rejects any allocation beyond the verified total**, so one green tonne cannot be sold twice.
5. **Disclose selectively.** The importer gets a link with the emissions intensity, a Merkle proof and both signatures. The browser verifies everything locally and reads the on-chain registry itself. Recipes, fuel mix and energy data stay private.

## Why blockchain

No single party (plant, verifier, an importer in another country, customs) is trusted by all the others to run a shared database. Allocation limits must also hold across importers who never talk to each other. A public chain gives every party the same tamper-evident record and enforces the limit in code.

**What it does not do:** it does not make data true. That is the job of the plausibility guard and the accredited verifier. Only fingerprints go on-chain, never plant data.

## Why post-quantum

CBAM declarations back financial and legal claims that can be audited years later. A signature made today must still hold when quantum computers may forge ECDSA. The hybrid rule requires **both** ML-DSA-65 and ECDSA P-256 to verify, so a report stays secure if either scheme is broken.

## Key numbers

All from [CLIMATE_IMPACT.md](CLIMATE_IMPACT.md). Plant data is synthetic.

| | Default values | Verified with VERDANT-X |
|---|---|---|
| Value of one tonne of CO₂ cut | €0 | **≈ €77** (2026 certificate price) |
| CBAM cost per tonne of cement, 2026 | €72.58 | €7.79–20.80 (three synthetic plants) |
| Same green tonne sold twice | Not prevented | Blocked on-chain (`OverAllocation`) |

- Verified data instead of default values is worth **≈ €330 M a year** across Türkiye's EU-bound cement volume at the 2026 price (indicative).
- A 5–20% cut in intensity on that volume would avoid **≈ 0.25–1.0 Mt CO₂ a year**. These are scenarios for what verified pricing makes worthwhile, not forecasts.
- The guard catches **216/216** injected frauds on synthetic data, and blocks no honest month (`make eval`). The rules were written together with the fraud types, so this is optimistic.

## Status

- **Working prototype**, end to end: plant, verifier, importer and regulator screens on a FastAPI backend.
- **Deployed on Polygon Amoy testnet**, source verified on [Polygonscan](https://amoy.polygonscan.com/address/0xdA8D576790524F96Ee6DFC5365C8aF6Be33d4230#code).
- **Tested:** 32 backend tests and 9 contract tests pass (`make test`).
- **Independent verification:** the backend signs with liboqs and `cryptography`, and the browser verifies with `@noble` libraries.
- **Honest limits:** synthetic data, an in-memory store, demo keys on the server, Merkle proofs rather than zero-knowledge proofs. See [SECURITY.md](SECURITY.md) and [ROADMAP.md](ROADMAP.md).

VERDANT-X supports accredited verifiers and the EU CBAM Registry. It does not replace them.
