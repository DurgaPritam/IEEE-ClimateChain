# Video script: 3 minutes

The judges ask the presentation to cover three things: **1) the climate problem, 2) how the solution works, 3) the real-world environmental impact.** The script follows that order, and each beat names the screen to show.

About 420 words of voice-over at 140–150 words a minute. Record on Polygon Amoy (`CHAIN_BACKEND=web3`, a fresh `CHAIN_NAMESPACE`), so every transaction hash opens on Polygonscan. Figures marked ≈ come from live data; read them off the screen.

**Before recording:**
- Top up both wallets.
- Run `make api` and `make web`.
- Open the tabs in the order below.
- Set the browser zoom to 110%.
- Turn on dark mode.

---

## 1. The climate problem (0:00–0:35)

| Time | Screen | Voice-over | On-screen text |
|---|---|---|---|
| 0:00 | Title card: VERDANT-X logo | "Since January 2026, the EU charges a carbon price at the border on imported cement." | **VERDANT-X**: verified, private, quantum-safe embedded carbon |
| 0:07 | CBAM timeline card | "Türkiye is the EU's largest supplier. Without verified data, importers must pay on EU default values: 1.584 tonnes of CO₂ per tonne, almost double what Turkish plants actually emit." | 1.584 default vs ≈ 0.82 actual (t CO₂/t) |
| 0:20 | Same card, one line animates | "So a plant that cuts its emissions pays exactly the same. A tonne of CO₂ cut is worth nothing. And verification is slow, exposes trade secrets, and nothing stops one green tonne being sold twice." | **€0** per tonne of CO₂ cut · double counting |

## 2. How it works (0:35–2:15)

| Time | Screen | Voice-over |
|---|---|---|
| 0:35 | Role cards: plant, verifier, importer, regulator | "VERDANT-X connects the four parties who don't trust each other: the plant, the verifier, the EU importer, and the regulator." |
| 0:42 | **Plant → Submit month** (Aegean, honest) | "The Aegean plant submits December. The engine uses the official CBAM method for cement: clinker chemistry, fuels, electricity." |
| 0:52 | **Report**: all checks pass | "Before anything is recorded, the guard checks chemistry, physics and the plant's own history. Every check gives a plain-language reason." |
| 1:00 | **Submit** again as Marmara, scenario *Understated calcination*, then **Report**: blocked | "Here's a plant that understates its process CO₂ by twenty percent. Chemistry says that's impossible, so it's blocked and sent back to the plant. It is never recorded." |
| 1:08 | Click **Full-screen view** (`/story/calcination`) | (hold for 2 s, no voice) |
| 1:12 | **Sign & anchor** on Aegean | "The honest report is signed with two signatures: ECDSA, and ML-DSA, the new NIST post-quantum standard. Only its fingerprint goes on Polygon." |
| 1:25 | Click the tx hash, Polygonscan opens | "On-chain, on a contract whose source anyone can read." |
| 1:30 | **Verifier → Review queue**: co-sign | "An accredited verifier reviews the flags and co-signs. The contract won't let a plant verify itself." |
| 1:38 | **Allocate tonnes**: 40,000 t to Hamburg | "Now the plant sells forty thousand verified tonnes to a Hamburg importer." |
| 1:45 | Allocate 90,000 t to Rotterdam: refused, then the full-screen view (`/story/double`) | "Then it tries to sell more than it has to Rotterdam. The contract refuses: double counting is impossible." |
| 1:55 | **Importer → disclosure link**: all checks green | "The importer gets one link. Their browser checks both signatures, the Merkle proofs and the on-chain records itself, without trusting our server. They see the emissions number, not the recipe." |
| 2:08 | Edit a disclosed value; checks turn red | "Change one byte and verification fails." |

## 3. Real-world impact (2:15–2:55)

| Time | Screen | Voice-over |
|---|---|---|
| 2:15 | **Money screen** (Ledger): saving, then the climate strip | "For this shipment, the CBAM bill drops from about €2.9 million to €0.3 million. More importantly, every tonne of CO₂ the plant cuts is now worth seventy-seven euros at the border, instead of zero." |
| 2:30 | **Over time** layout, click 2030 then 2034 | "And that reward grows every year until 2034, as the EU phases out free allocation." |
| 2:37 | **Regulator → Audit trail** (Live), the Refused card | "Regulators see everything that was verified, and everything that was refused." |
| 2:43 | Impact card | "Across Türkiye's roughly six million tonnes a year of EU-bound cement, a ten percent cut is half a million tonnes of CO₂ a year. Verified data is what makes that cut pay." |

## 4. Close (2:55–3:00)

| Time | Screen | Voice-over | On-screen text |
|---|---|---|---|
| 2:55 | End card | "VERDANT-X. Every tonne, verified, private and counted once." | Repo URL · contract on Polygonscan · "All plant data is synthetic" |

---

## Cards to prepare

1. **Title:** "VERDANT-X: Every tonne of embedded carbon. Verified, private, and quantum-safe."
2. **CBAM timeline:**
   - 1 Jan 2026: CBAM obligations start
   - Default value 1.584 → 1.728 (2027) → 1.872 (2028+)
   - Free allocation 97.5% (2026) → 0% (2034)
3. **Role cards:** Plant (submits and signs), Verifier (co-signs), EU importer (verifies in the browser), Regulator (audits).
4. **Impact:**
   - ≈ 6.1 Mt a year of EU-bound cement from Türkiye
   - 10% cut ≈ 0.5 Mt CO₂ a year
   - €0 → €77.65 per tonne cut
   - Sources in docs/CLIMATE_IMPACT.md
5. **End card:**
   - github.com/DurgaPritam/IEEE-ClimateChain
   - amoy.polygonscan.com/address/0xdA8D…4230#code
   - "All plant data is synthetic."

## Recording tips

- **Practise the clicks** on the in-memory chain with `make demo`, so they don't burn POL.
- **Then record one take on Amoy.** Every Amoy transaction takes a few seconds; cut the waits in editing.
- **Name the criteria words where they fit:** "double counting", "real-time", "transparency", "climate impact".
- **Show "Synthetic demo data"** in the top bar in at least one shot.
