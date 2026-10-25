# Video script (up to 4 minutes)

The judges ask the presentation to cover three things: **1) the climate problem, 2) how the solution works, 3) the real-world environmental impact.** The script follows that order: a sharp problem, the vision in one line, the proof in the demo, then the impact.

**Length.** The full script is about **3:30 of speech**; with clicks and pauses it fits in **4:00** (scene times below include them). The IEEE event page asks for a **3-minute** video. If Devpost says the same, skip every line marked **✂︎**: about **2:50 of speech**. Talk over the clicks rather than waiting for them.

**Delivery.**
- Calm, direct, factual. State the problem, then show the proof. Say "VERDANT-X does", never "we tried" or "it could".
- Pause after each **bold** phrase.
- Cut the blockchain waits in editing.

**Setup.**
- Use a fresh `CHAIN_NAMESPACE` for each take (`run2`, `run3`…) and restart `make api`.
- Turn on dark mode and set the browser zoom to 110%.
- The cards are in `video/cards/`.

---

## 1. The problem (0:00–0:37)

**Show:** `1-title.png` (5 s), then `2-cbam.png`.

> "Since January 2026, the EU charges a carbon price on imported cement, and **Türkiye supplies almost half of those imports.**
>
> Exporters that can't prove their emissions are charged EU default values: **almost double what Turkish plants actually emit.** The industry overpays by around **three hundred and thirty million euros a year**, and a plant that cuts its emissions gains **nothing.**
>
> The real data exists. What's missing is a way to **prove it**: without exposing trade secrets, and without the same tonne being claimed twice."

## 2. The vision (0:37–0:57)

**Show:** `3-vision.png`.

> "**VERDANT-X is that proof layer.** Plants calculate and sign their real emissions, accredited verifiers co-sign, and every verified tonne is anchored **once** on Polygon: post-quantum signed and private by design.
>
> **Our vision: verified emissions become the standard for every product crossing the EU carbon border.**"

## 3. An honest month (0:57–1:16)

**Click:** Plant operator → **Aegean Cement** → **Submit month** → **Honest month** → **Calculate and run checks →**

> "Here is the Aegean plant reporting December. VERDANT-X calculates its emissions with the **official EU method**, then checks every number against **chemistry, physics and the plant's own history.** ✂︎ *Every check passes, and every check explains itself in plain language.*"

## 4. Fraud is stopped (1:16–1:37)

**Click:** **Marmara Cement** → **Submit month** → **Fraud · calcination below chemistry** → **Calculate** → red Blocked banner → **Full-screen view** (2 s).

> "Now a plant tries to cheat, and under-reports its CO₂ by twenty percent. **VERDANT-X stops it on the spot.** The chemistry doesn't add up, so it never gets signed and never reaches the blockchain. ✂︎ *We tested two hundred and sixteen frauds. Every single one was caught.*"

## 5. Sign and anchor (1:37–1:57)

**Click:** **Aegean Cement** → **Sign & anchor** → **Sign & anchor →** → **Next step →** → **Explorer ↗** (Polygonscan, 2 s) → back to the app.

> "The honest report is signed with **ML-DSA, the new NIST post-quantum standard**, together with classic ECDSA. ✂︎ *These records will stay trustworthy even when quantum computers arrive.* Its fingerprint is locked on **Polygon**, in a contract anyone can read. **No plant secret ever touches the chain.**"

## 6. The verifier (1:57–2:06)

**Click:** **Verifier** → the Aegean report → **Co-sign report →**

> "An accredited verifier reviews and co-signs. ✂︎ *A plant can never verify itself; the contract won't allow it.*"

## 7. Double counting is impossible (2:06–2:24)

**Click:**
1. **Plant operator** → **Allocate tonnes**.
2. `SHIP-HAM-1`, **Hamburg**, `40000` t → **Allocate**.
3. `SHIP-RTM-1`, **Rotterdam** → **Demo: request remaining + 10,000 t** → **Allocate** → red rejection → **Full-screen view** (2 s).

> "The plant sells forty thousand verified tonnes to Hamburg. Then it tries to sell the same green tonnes again, to Rotterdam. **Refused.** ✂︎ *Double counting is the core credibility problem in carbon markets.* **On VERDANT-X, it cannot happen.**"

## 8. The importer trusts no one (2:24–2:45)

**Click:**
1. **EU importer** → **SHIP-HAM-1 ↗**. Wait until every row is green.
2. Point at "What you are not seeing".
3. ✂︎ **Simulate tampering** → red → **Restore original package**.

> "The importer gets one link, and **their own browser proves everything**: both signatures, every Merkle proof, straight from the blockchain. There's no need to trust anyone. They see the verified number, and **the plant's secrets stay secret.** ✂︎ *Change a single digit, and the proof breaks instantly.*"

## 9. The money (2:45–3:10)

**Click:** **Open cost comparison →**. Year **2026** (Ledger), then ✂︎ **2034**.

> "On this one shipment, the carbon bill drops from **two point nine million euros to three hundred thousand. Two point six million euros saved.** ✂︎ *By 2034, three point eight million.*
>
> More importantly, **every tonne of CO₂ this plant cuts is now worth seventy-seven euros at the border**, instead of zero. That is the incentive to decarbonise."

Point at **€0 → €77.65** in the bottom strip as you say it.

## 10. The regulator (3:10–3:17) ✂︎

**Click:** **Regulator** → Audit trail (Live). Point at the four figures, then **Refused**.

> ✂︎ "Regulators watch it all, live: every verified tonne, and **every attempt we stopped.**"

## 11. Impact (3:17–3:43)

**Show:** `6-who-it-helps.png`.

> "**Exporters** stay competitive in the EU market and are paid for every tonne they cut. **Importers** pay on numbers they can prove. ✂︎ *Regulators see every tonne, counted once.*
>
> **And the climate:** a ten percent cut across Türkiye's EU-bound cement avoids **half a million tonnes of CO₂ a year**, the annual emissions of **over one hundred thousand cars.**"

## 12. The close (3:43–3:56)

**Show:** `5-end.png`.

> ✂︎ *"We start with Turkish cement. The same architecture extends to steel, aluminium and fertiliser, and to every exporter facing CBAM."*
>
> "**VERDANT-X. Every tonne: verified, private, and counted once.**"

---

## Where the numbers come from (in case a judge asks)

| Claim | Source |
|---|---|
| Almost half of EU cement imports; ≈ 6.1 Mt a year | 42.9% of 14.2 Mt in 2025, Cement Europe / Eurostat |
| Default almost double actual (1.584 vs ≈ 0.82) | IR 2025/2621 as corrected by 2026/1740; TürkÇimento 2026, EBRD 2023 |
| €330 M a year | Default vs verified cost on ≈ 6.1 Mt at the 2026 price; indicative, calculated in docs/CLIMATE_IMPACT.md |
| €2.9 M → €0.3 M; €3.8 M in 2034 | Live output of the pricing module for this shipment (read it off your screen) |
| €77.65 per tonne | Mean of the official 2026 CBAM certificate prices, Q1–Q3 |
| 216 of 216 frauds caught | `make eval` on synthetic data |
| 0.5 Mt CO₂ a year for a 10% cut | 10% of 6.1 Mt × 0.82 t/t; a scenario, not a forecast |
| More than 100,000 cars | 0.5 Mt ÷ 4.6 t CO₂ per car per year ≈ 108,000 (US EPA, typical passenger vehicle) |
