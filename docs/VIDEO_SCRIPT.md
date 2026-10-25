# Video script (up to 4 minutes)

The judges ask the presentation to cover three things: **1) the climate problem, 2) how the solution works, 3) the real-world environmental impact.** The script follows that order.

**Length.** The full script runs about **3:55** at a steady 145 words a minute. The IEEE event page asks for a **3-minute** video. If Devpost says the same, drop every line marked **✂︎**: the rest runs about **3:00**.

**Tone.** Confident, not rushed. Pause after each **bold** phrase. Cut the 3–5 s blockchain waits in editing.

**Setup.**
- Use a fresh `CHAIN_NAMESPACE` for each take (`run2`, `run3`…) and restart `make api`.
- Turn on dark mode and set the browser zoom to 110%.
- The cards are in `video/cards/`.

---

## 1. The problem (0:00–0:30)

**Show:** `1-title.png` (5 s), then `2-cbam.png`.

> "Türkiye supplies **almost half of all the cement the European Union imports.** And since January 2026, every tonne of it pays a carbon price at the EU border.
>
> Here is the problem. Without proof, importers are charged on EU default values: **1.584 tonnes of CO₂ for every tonne of cement.** Turkish plants actually emit about 0.82. **Almost double.**
>
> That gap costs Turkish cement **around three hundred and thirty million euros a year.** And it hurts the climate: on default values, a plant that cuts its emissions pays exactly the same. **Cutting CO₂ is worth zero.**"

## 2. The solution (0:30–0:45)

**Show:** `3-roles.png`.

> "We built **VERDANT-X** to change that. It gives the plant, the verifier, the EU importer and the regulator **one shared, tamper-proof record**. It's built on Polygon, protected by **post-quantum cryptography**, and private by design. ✂︎ *Let me show you.*"

## 3. An honest month (0:45–1:05)

**Click:** Plant operator → plant **Aegean Cement** → **Submit month** → scenario **Honest month** → **Calculate and run checks →**

> "This is the Aegean plant, submitting December. VERDANT-X calculates embedded emissions with the **official EU CBAM method**: clinker chemistry, every fuel, every megawatt-hour. ✂︎ *Then, before anything is recorded,* our plausibility guard checks the data against **chemistry, physics and the plant's own history.** ✂︎ *Every check passes, and every check explains itself in plain language.*"

## 4. Fraud is stopped (1:05–1:25)

**Click:** plant **Marmara Cement** → **Submit month** → **Fraud · calcination below chemistry** → **Calculate** → the red Blocked banner → **Full-screen view** (hold 2 s).

> "Now watch a plant try to cheat. Marmara reports twenty percent less process CO₂ than its own chemistry allows. **VERDANT-X blocks it instantly.** It can't be signed, it never reaches the blockchain, and it goes straight back to the plant. ✂︎ *On our synthetic test set, all two hundred and sixteen injected frauds were caught.*"

## 5. Sign and anchor (1:25–1:50)

**Click:** plant **Aegean Cement** → **Sign & anchor** → **Sign & anchor →** → **Next step →** → **Explorer ↗** (Polygonscan, 2 s) → back to the app.

> "The honest report is signed twice: with ECDSA, and with **ML-DSA, the new NIST post-quantum standard.** ✂︎ *So these records stay trustworthy for decades, even against quantum computers.* Its fingerprint is anchored on **Polygon**, in a smart contract whose source code anyone can read. **No confidential plant data ever goes on-chain.**"

## 6. The verifier (1:50–2:00)

**Click:** **Verifier** → select the Aegean report → **Co-sign report →**

> "An accredited verifier reviews the evidence and co-signs. ✂︎ *The contract makes it impossible for a plant to verify itself.*"

## 7. Double counting is impossible (2:00–2:25)

**Click:**
1. **Plant operator** → **Allocate tonnes**.
2. Shipment `SHIP-HAM-1`, importer **Nordhafen (Hamburg)**, `40000` t → **Allocate**.
3. Shipment `SHIP-RTM-1`, importer **Delta Bouw (Rotterdam)** → **Demo: request remaining + 10,000 t** → **Allocate** → red rejection → **Full-screen view** (2 s).

> "Now the plant sells **forty thousand verified tonnes** to an importer in Hamburg. Then it tries to sell the same green tonnes again, to Rotterdam. **The smart contract refuses.** ✂︎ *Double counting is one of the biggest credibility problems in carbon markets.* **Here, it is simply impossible.**"

## 8. The importer trusts no one (2:25–2:55)

**Click:**
1. **EU importer** → **SHIP-HAM-1 ↗**. Wait until every row is green.
2. Point at "What you are not seeing".
3. **Simulate tampering** → the page turns red → **Restore original package**.

> "The importer in Hamburg receives one link. **Their own browser** verifies both signatures, checks every Merkle proof, and **reads the blockchain directly.** There's no need to trust us, or anyone. They see the verified emissions. They never see the recipe, the fuel mix or the energy contracts. ✂︎ *And if anyone tampers with a single number, verification fails instantly.*"

## 9. The money (2:55–3:20)

**Click:** **Open cost comparison →**. Year **2026** (Ledger), then click **2034**.

> "Now here is what that means. On this one shipment, the 2026 CBAM bill falls from **two point nine million euros to about three hundred thousand**: a saving of **two point six million euros.** ✂︎ *(click 2034) By 2034, the saving on the same shipment grows to three point eight million.*
>
> But the real breakthrough is this: **every tonne of CO₂ this plant cuts is now worth seventy-seven euros at the border, instead of zero.**"

While you say "seventy-seven euros", point at **€0 → €77.65** in the bottom strip.

## 10. The regulator (3:20–3:30) ✂︎

**Click:** **Regulator** → Audit trail (Live). Point at the four figures, then the **Refused** list.

> ✂︎ "Regulators and customs see everything, live: every tonne verified, and **every attempt that was refused.**"

## 11. The impact (3:30–3:50)

**Show:** `4-impact.png`.

> "Now scale this to Türkiye's **six million tonnes** of cement shipped to the EU every year. A ten percent cut in emissions avoids **half a million tonnes of CO₂, every single year.** And with VERDANT-X, **that cut finally pays.**"

## 12. The close (3:50–3:58)

**Show:** `5-end.png`.

> ✂︎ *"Cement today. Steel, aluminium and fertiliser next: every sector under CBAM has this same problem. This is VERDANT-X."*
>
> "**VERDANT-X. Every tonne: verified, private, and counted once.**"

---

## Where the numbers come from (in case a judge asks)

| Claim | Source |
|---|---|
| Almost half of EU cement imports; ≈ 6.1 Mt a year | 42.9% of 14.2 Mt in 2025, Cement Europe / Eurostat |
| Default value 1.584; actual ≈ 0.82 | IR 2025/2621 as corrected by 2026/1740; TürkÇimento 2026, EBRD 2023 |
| ≈ €330 M a year | Default vs verified cost on ≈ 6.1 Mt at the 2026 price; indicative, calculated in docs/CLIMATE_IMPACT.md |
| €2.9 M → €0.3 M; €3.8 M in 2034 | Live output of the pricing module for this shipment (read it off your screen) |
| €77.65 per tonne | Mean of the official 2026 CBAM certificate prices, Q1–Q3 |
| 0.5 Mt CO₂ a year for a 10% cut | 10% of 6.1 Mt × 0.82 t/t; a scenario, not a forecast |
| 216 of 216 frauds caught | `make eval` on synthetic data |
