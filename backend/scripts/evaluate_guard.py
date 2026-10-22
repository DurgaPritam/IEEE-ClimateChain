"""Detection rates of the plausibility guard on synthetic data: `make eval`.

Trains each plant's anomaly model on 12 honest months, then injects every fraud type
into each of the following 12 months and counts what each layer catches. Honest
copies of the same months measure false alarms.
"""

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.data.synthetic import FRAUD_TYPES, PLANTS, _month  # noqa: E402
from app.guard import Guard  # noqa: E402
from app.models import Severity  # noqa: E402
from app.sectors import get_sector  # noqa: E402

TRAIN, TEST = range(12), range(12, 24)


def evaluate() -> tuple[dict[str, dict[str, int]], dict[str, int], int]:
    sector = get_sector("cement")
    caught = {f: {"anomaly": 0, "blocked": 0, "any": 0} for f in FRAUD_TYPES}
    honest = {"anomaly": 0, "blocked": 0, "n": 0}
    for p in PLANTS:
        history = []
        for m in TRAIN:
            x = _month(p, m, random.Random(1000 + m), None)
            history.append((x, sector.calculate(x)))
        guard = Guard("cement")
        guard.fit_anomaly(history)
        for m in TEST:
            for kind in [None, *FRAUD_TYPES]:
                x = _month(p, m, random.Random(1000 + m), kind)  # same seed: identical month, fraud applied
                g = guard.check(x, sector.calculate(x), history)
                anomaly = any(f.rule_id == "anomaly_model" and f.severity == Severity.WARN for f in g.flags)
                if kind is None:
                    honest["n"] += 1
                    honest["anomaly"] += anomaly
                    honest["blocked"] += g.blocked
                else:
                    c = caught[kind]
                    c["anomaly"] += anomaly
                    c["blocked"] += g.blocked
                    c["any"] += any(f.severity != Severity.PASS for f in g.flags)
    return caught, honest, len(PLANTS) * len(TEST)


if __name__ == "__main__":
    caught, honest, n = evaluate()
    print(f"{'fraud':22}{'anomaly model':>15}{'rules block':>14}{'caught (any)':>15}")
    for kind, c in caught.items():
        print(f"{kind:22}{c['anomaly']:>12}/{n}{c['blocked']:>11}/{n}{c['any']:>12}/{n}")
    total = n * len(caught)
    print(f"{'all':22}{sum(c['anomaly'] for c in caught.values()):>11}/{total}"
          f"{sum(c['blocked'] for c in caught.values()):>10}/{total}"
          f"{sum(c['any'] for c in caught.values()):>11}/{total}")
    print(f"honest months: {honest['anomaly']}/{honest['n']} anomaly false alarms, "
          f"{honest['blocked']}/{honest['n']} wrongly blocked")
