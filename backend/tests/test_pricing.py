import pytest

from app.pricing.cbam_cost import compare


def test_verified_is_cheaper_than_default():
    c = compare("cement", 10_000, verified_see=0.83, year=2026)
    assert c.verified.net_cost_eur < c.default.net_cost_eur
    assert c.saving_eur == pytest.approx(c.default.net_cost_eur - c.verified.net_cost_eur)


def test_obligation_never_negative():
    c = compare("cement", 10_000, verified_see=0.1, year=2026)
    assert c.verified.obligation_tco2 == 0
    assert c.verified.net_cost_eur == 0


def test_carbon_price_deduction_is_capped():
    c = compare("cement", 10_000, verified_see=0.83, year=2026, carbon_price_paid_eur=10**9)
    assert c.verified.net_cost_eur == 0


def test_phase_out_increases_cost():
    assert compare("cement", 1, 0.83, year=2034).verified.net_cost_eur > \
        compare("cement", 1, 0.83, year=2026).verified.net_cost_eur


def test_default_value_includes_yearly_markup():
    see = {y: compare("cement", 1, 0.83, year=y).default.see_tco2_per_t for y in (2026, 2027, 2028, 2034)}
    assert see == {2026: 1.584, 2027: 1.728, 2028: 1.872, 2034: 1.872}


def test_verified_benchmark_scales_with_clinker_ratio():
    low, high = (compare("cement", 1, 0.83, precursor_ratio=r) for r in (0.7, 0.95))
    assert low.verified.benchmark_deduction_tco2_per_t < high.verified.benchmark_deduction_tco2_per_t
    assert low.default.benchmark_deduction_tco2_per_t == high.default.benchmark_deduction_tco2_per_t
