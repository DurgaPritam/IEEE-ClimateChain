# Climate impact assessment

**VERDANT-X makes every tonne of CO₂ a cement plant cuts worth money at the border, and keeps that reward honest.**

## 1. The problem: default values give exporters no reason to cut emissions

Since 1 January 2026, EU importers of cement must buy CBAM certificates for the CO₂ embedded in it. Türkiye is the largest supplier. It provided **42.9% of the EU's 14.2 Mt of cement and clinker imports in 2025**, about 6.1 Mt [3].

An importer can price a shipment in one of two ways:

- **EU default value.** Türkiye has no country-specific value, so grey cement is charged at **1.440 t CO₂/t plus a mark-up**: 1.584 in 2026, 1.728 in 2027, and 1.872 from 2028 [1][2].
- **Verified actual emissions** from the plant. Turkish exporters report about **0.88 t CO₂/t clinker** [5], which is about 0.82 t CO₂/t cement [6].

On default values, a plant that halves its emissions pays the same as one that does nothing. **The reward for each tonne cut is €0.** Verified data is the only route by which decarbonisation shows up in the price. Today that route is slow, it exposes confidential process data, and nothing stops one verified low-carbon tonne from being claimed by two importers.

## 2. What VERDANT-X changes

| | Without VERDANT-X (default values) | With VERDANT-X (verified actuals) |
|---|---|---|
| Value of one tonne of CO₂ cut | €0 | **≈ €77**, the 2026 CBAM certificate price [4] |
| Cost per tonne of cement, 2026 | €72.58 | €7.79–20.80 (the synthetic plants below) |
| Plant must reveal recipes and fuel mix | – | No. Selective disclosure with Merkle proofs |
| Same green tonne sold twice (double counting) | Not prevented | **Blocked on-chain** (`OverAllocation`) |
| Under-reported data | – | Blocked or flagged by the plausibility guard before signing |

The two integrity features protect the climate signal, not just the paperwork. If one low-carbon tonne is claimed by two importers, or if a plant understates its process CO₂, embedded emissions are under-counted. The carbon price then stops rewarding real cuts.

## 3. Numbers from the working prototype

These numbers come from the backend pricing module (`backend/app/pricing/cbam_cost.py`). They use the official 2026 default values, the CBAM benchmarks and the free-allocation phase-out [1][2][7], at €77.65/t CO₂. All plant data is synthetic.

| Synthetic plant | Profile | Verified intensity (t CO₂/t) | 2026 cost per t: default → verified | 2030 | 2034 |
|---|---|---|---|---|---|
| Anatolia | CEM I, petcoke and coal | 0.835 | €73 → €18 | €119 → €40 | €145 → €65 |
| Aegean | CEM II/A, 25% biomass | **0.632** | €73 → **€8** | €119 → €27 | €145 → €49 |
| Marmara | CEM I, petcoke and lignite | 0.878 | €73 → €21 | €119 → €43 | €145 → €68 |

**The incentive.** Aegean emits **0.20 t CO₂ less per tonne** than Anatolia because it uses less clinker and more biomass. On default values, both plants pay the same. On verified data, Aegean saves an extra **€10 per tonne in 2026, growing to €16 by 2034** as free allocation is phased out. For a plant shipping 1 Mt a year to the EU, moving to Aegean's profile avoids **about 200,000 t CO₂ a year** and is worth about €10–16 M a year. VERDANT-X makes that saving visible and claimable.

## 4. Projections at the scale of Türkiye's EU exports

These projections assume ≈ 6.1 Mt a year of EU-bound volume [3] and a baseline of 0.82 t CO₂/t [6]. They are scenarios for what verified pricing makes worthwhile, not forecasts.

| Intensity cut on EU-bound cement | CO₂ avoided per year | Basis for the scenario |
|---|---|---|
| 5% (fuel switching, efficiency) | ≈ 0.25 Mt | The kiln fuel share alone; thermal efficiency is 6.8% of Türkiye's pathway [8] |
| 10% (clinker ratio 0.90 → ≈ 0.80) | ≈ 0.50 Mt | Lower clinker ratio is 37% of global reductions to 2050 [9] |
| 20% (blended or LC3-type cements) | ≈ 1.0 Mt | LC3 studies report 20–40% less CO₂ per tonne [10] |

At the 2026 price, verified data instead of default values is worth **≈ €330 M a year** across this volume. This is an indicative figure that treats all of it as cement. The incentive grows each year until 2034, when free allocation reaches zero.

## 5. What this assessment does not claim

- **Incentive is not action.** VERDANT-X makes cuts pay. The plant still has to invest.
- **The data is synthetic.** The anomaly model alone catches 46% of injected frauds, and the full guard catches all of them on synthetic data (`make eval`). Real plant data will be noisier.
- **It doesn't replace verification.** VERDANT-X supports accredited verifiers and the EU CBAM Registry; it does not replace them.
- **No Turkish carbon price is deducted.** Türkiye's ETS pilot has no allowance price in 2026, so none is counted [11].

## 6. Beyond cement

CBAM already covers iron and steel, aluminium, fertilisers, hydrogen and electricity, and every one has the same default-value problem. The trust layer, the chain and the API don't depend on the sector. Adding a sector means adding a calculation module, a config file and a rule set (see the README, "Extending").

## Sources

1. DG TAXUD, CBAM default values (IR (EU) 2025/2621 as corrected by IR (EU) 2026/1740), version of 6 Aug 2026. [xlsx](https://taxation-customs.ec.europa.eu/document/download/1c05d211-80cb-4aaa-8ef0-e08005a95d7e_en?filename=DV%20correcting%20act_final%20update_06.08.xlsx)
2. Mark-up schedule for cement (10% / 20% / 30%): [O'Melveny](https://www.omm.com/insights/alerts-publications/how-the-eu-s-new-default-emissions-values-under-cbam-impact-us-exporters-what-you-need-to-know-for-2026/), [CBAM Guide](https://cbamguide.com/compliance/default-values/)
3. Cement Europe, Trade report full year 2025 (Eurostat data), April 2026. [pdf](https://www.cementeurope.eu/media/bw4j1sxx/cement-europe-trade-report-full-year-2025-april-2026.pdf)
4. European Commission, price of CBAM certificates 2026: Q1 €75.36, Q2 €75.28, Q3 €82.32. [link](https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/price-cbam-certificates_en)
5. TürkÇimento, "Actual emissions must be taken into account", 25 Feb 2026. [link](https://www.turkcimento.org.tr/en/news_detail/turkcimento-actual-emissions-must-be-taken-into-account)
6. EBRD, *A Low Carbon Pathway for the Cement Sector in Türkiye*, 2023, Fig. 40 (approximate, read from a chart). [pdf](https://www.ebrd.com/content/dam/ebrd_dxp/assets/pdfs/green-economy-transition/low-carbon-pathways/Cement%20Sector%20in%20Turkey.pdf)
7. DG TAXUD, CBAM Benchmarks (IR (EU) 2025/2620), 6 Feb 2026 [xlsx](https://taxation-customs.ec.europa.eu/document/download/9877523c-2a02-4926-a211-aefae7cf6d0d_en?filename=CBAM%20Benchmarks_20260206.xlsx); CBAM Guidance No. 4, free-allocation phase-out. [pdf](https://taxation-customs.ec.europa.eu/document/download/3aa2c730-4f1b-4524-8f71-d9cfe4880ac7_en?filename=Guidance%20No.%204%20-%20CBAM%20calculation%20of%20the%20free%20allocation%20adjustment%20to%20the%20number%20of%20CBAM%20certificates%20to%20be%20surrendered.pdf)
8. EBRD 2023 (as [6]), Türkiye 2053 pathway by lever.
9. IEA / CSI, *Technology Roadmap: Low-Carbon Transition in the Cement Industry*, 2018. [pdf](https://iea.blob.core.windows.net/assets/cbaa3da1-fd61-4c2a-8719-31538f59b54f/TechnologyRoadmapLowCarbonTransitionintheCementIndustry.pdf)
10. LC3 project, *LC3: a sustainable alternative*, 2022. [pdf](https://lc3.ch/wp-content/uploads/2022/11/LC3-A-sustainable-alternative-FINAL-WEB.pdf)
11. ICAP, "Türkiye unveils regulation for its national ETS", 2026. [link](https://icapcarbonaction.com/en/news/turkiye-unveils-regulation-its-national-emissions-trading-system)
