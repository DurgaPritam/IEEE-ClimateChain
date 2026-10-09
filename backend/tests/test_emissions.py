import pytest

from app.sectors.cement import CementInputs, CementSector


def worked_example(**overrides) -> CementInputs:
    base = dict(
        clinker_produced_t=1000, clinker_consumed_t=900, additives_t=100, cement_produced_t=1000,
        cement_type="CEM_I", clinker_cao=0.65, clinker_mgo=0.02, fuels_t={"petcoke": 100},
        electricity_kiln_mwh=30, electricity_grinding_mwh=40,
    )
    return CementInputs(**(base | overrides))


def test_hand_worked_example():
    # calcination = 1000 * (0.785*0.65 + 1.092*0.02)       = 532.09 t
    # fuel        = 100 t * 32.5 GJ/t * 97.5 t/TJ / 1000    = 316.875 t
    # indirect    = 30 MWh * 0.442 (kiln), 40 MWh * 0.442 (grinding)
    # SEE_direct  = 0.9 * 848.965 / 1000                    = 0.7641
    # SEE_indirect= 0.9 * 13.26/1000 + 17.68/1000            = 0.0296
    r = CementSector().calculate(worked_example())
    assert r.breakdown["calcination_tco2"] == pytest.approx(532.09)
    assert r.breakdown["kiln_fuel_tco2"] == pytest.approx(316.88, abs=0.01)
    assert r.see_direct == pytest.approx(0.7641)
    assert r.see_indirect == pytest.approx(0.0296)
    assert r.see_total == pytest.approx(0.7937)


def test_biomass_is_zero_rated():
    r = CementSector().calculate(worked_example(fuels_t={"biomass": 100}))
    assert r.breakdown["kiln_fuel_tco2"] == 0


def test_reported_process_co2_never_lowers_calcination():
    low = CementSector().calculate(worked_example(reported_process_co2_t=100))
    assert low.breakdown["calcination_tco2"] == pytest.approx(532.09)
    high = CementSector().calculate(worked_example(reported_process_co2_t=600))
    assert high.breakdown["calcination_tco2"] == 600
