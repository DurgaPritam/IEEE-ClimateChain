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
