"""Isolation Forest anomaly model with SHAP explanations.

Catches combinations that no single rule catches. A flag is always a WARN for
human review, never an automatic block, and always carries per-feature reasons.
"""

from collections.abc import Callable

import numpy as np
import shap
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest

from app.models import EmissionsResult, Flag, Severity

FeatureFn = Callable[[BaseModel, EmissionsResult], dict[str, float]]


class AnomalyModel:
    id = "anomaly_model"
    title = "Anomaly model"

    def __init__(self, features: FeatureFn, contamination: float = 0.08, seed: int = 7):
        self.features = features
        self.contamination = contamination
        self.seed = seed
        self.model: IsolationForest | None = None
        self.names: list[str] = []

    def _vec(self, x: BaseModel, r: EmissionsResult) -> np.ndarray:
        return np.array(list(self.features(x, r).values()), dtype=float)

    def fit(self, rows: list[tuple[BaseModel, EmissionsResult]]) -> "AnomalyModel":
        self.names = list(self.features(*rows[0]).keys())
        X = np.vstack([self._vec(x, r) for x, r in rows])
        self.model = IsolationForest(
            n_estimators=200, contamination=self.contamination, random_state=self.seed
        ).fit(X)
        self.explainer = shap.TreeExplainer(self.model)
        return self

    def check(self, x: BaseModel, r: EmissionsResult, ctx=None) -> Flag:
        if self.model is None:
            return Flag(rule_id=self.id, title=self.title, severity=Severity.PASS,
                        reason="Not enough accepted history to train the model yet.")
        v = self._vec(x, r).reshape(1, -1)
        # Anomaly score in (0, 1]: higher is more unusual; the threshold is set by `contamination`.
        score, threshold = -self.model.score_samples(v)[0], -self.model.offset_
        expected, reported = f"score < {threshold:.2f}", f"{score:.2f}"
        if score <= threshold:
            return Flag(rule_id=self.id, title=self.title, severity=Severity.PASS,
                        reason="Isolation Forest score below the review threshold.",
                        expected=expected, reported=reported)
        # Negative SHAP values push the score towards "anomalous".
        contrib = dict(zip(self.names, self.explainer.shap_values(v)[0].round(4).tolist()))
        top = sorted(contrib.items(), key=lambda kv: kv[1])[:3]
        feats = self.features(x, r)
        return Flag(
            rule_id=self.id, title=self.title, severity=Severity.WARN,
            reason="Unusual combination of values compared with the plant's history; mostly driven by "
                   + ", ".join(f"{k} = {feats[k]:.3g}" for k, _ in top) + ".",
            contributions=contrib, expected=expected, reported=reported,
        )


def cement_features(x, r: EmissionsResult) -> dict[str, float]:
    from app.sectors.cement import CementSector

    s = CementSector()
    return {
        "kiln_gj_per_t_clk": s.kiln_energy_gj(x) / x.clinker_produced_t,
        "kwh_per_t_cem": (x.electricity_kiln_mwh + x.electricity_grinding_mwh) * 1000 / x.cement_produced_t,
        "clinker_ratio": x.clinker_consumed_t / x.cement_produced_t,
        "clinker_cao": x.clinker_cao,
        "fuel_co2_per_t_clk": r.breakdown["kiln_fuel_tco2"] / x.clinker_produced_t,
        "see_total": r.see_total,
    }


FEATURES: dict[str, FeatureFn] = {"cement": cement_features}
