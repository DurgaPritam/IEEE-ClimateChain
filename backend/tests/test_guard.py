from app.data.synthetic import generate
from app.guard import Guard
from app.models import Severity
from app.sectors import get_sector

sector = get_sector("cement")


def run_plant(plant_id: str):
    guard = Guard("cement")
    rows = generate()[plant_id]
    honest = [(x, sector.calculate(x)) for _, x, f in rows if not f]
    guard.fit_anomaly(honest[:12])
    history, results = [], []
    for period, x, fraud in rows:
        r = sector.calculate(x)
        g = guard.check(x, r, history)
        results.append((period, fraud, g))
        if not g.blocked:  # only accepted months become history
            history.append((x, r))
    return results


def test_every_injected_fraud_is_blocked():
    for _, fraud, g in run_plant("TR-MAR-03"):
        if fraud:
            assert g.blocked, fraud


def test_honest_plants_are_never_blocked():
    for plant in ("TR-ANA-01", "TR-AEG-02"):
        for period, _, g in run_plant(plant):
            assert not g.blocked, (plant, period, g.flags)


def test_every_flag_has_a_reason():
    for _, _, g in run_plant("TR-MAR-03"):
        for f in g.flags:
            assert f.reason
            if f.rule_id == "anomaly_model":
                assert f.contributions and f.severity == Severity.WARN
