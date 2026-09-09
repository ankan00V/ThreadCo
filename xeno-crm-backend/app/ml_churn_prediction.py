"""
Churn model — traditional ML, no Gen AI.

Predicts whether a customer will place a completed order in the 90 days after a
cutoff date, using only what was knowable before that cutoff.

WHY THIS FILE LOOKS PARANOID ABOUT LEAKAGE
------------------------------------------
The first version of this script defined the label as `recency_days > 90` and
then handed `recency_days` to the classifier as a feature. That scores near a
perfect AUC and means nothing whatsoever: the model is reading the answer off
the label's own definition. It is the most common way a churn model gets shipped
broken, so the guard against it here is explicit — features are computed strictly
from orders BEFORE the cutoff, and the label strictly from orders AFTER it.

WHAT THE RESULT IS EXPECTED TO BE
---------------------------------
The data-quality audit (/api/insights/audit) established that repeat-purchase
timing in this dataset is uniformly random — retention is flat across every
cohort and every month. If that finding is correct, then churn here is genuinely
unpredictable and an honest model must score close to AUC 0.50.

So this script is really a falsification test. A high AUC would mean the audit
was wrong or this script is leaking. ~0.50 means both are consistent. The result
is printed either way rather than tuned until it looks good.

Run:
    python -m app.ml_churn_prediction
"""

from __future__ import annotations

import os

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sqlalchemy import create_engine, text

load_dotenv()

# Orders after this point are the outcome, never an input.
CUTOFF_DAYS_AGO = 120
OUTCOME_WINDOW_DAYS = 90

FEATURE_SQL = f"""
WITH cutoff AS (
    SELECT now() - interval '{CUTOFF_DAYS_AGO} days' AS t
),
history AS (
    -- Everything knowable at the cutoff. Note the strict `<` on the cutoff.
    SELECT o.customer_id,
           count(*)                                             AS frequency,
           sum(o.amount)                                        AS monetary,
           avg(o.amount)                                        AS avg_basket,
           EXTRACT(EPOCH FROM ((SELECT t FROM cutoff) - max(o.created_at))) / 86400 AS recency_days,
           EXTRACT(EPOCH FROM ((SELECT t FROM cutoff) - min(o.created_at))) / 86400 AS tenure_days
    FROM orders o
    WHERE o.status = 'completed'
      AND o.created_at < (SELECT t FROM cutoff)
    GROUP BY o.customer_id
),
outcome AS (
    -- The label: did they come back inside the outcome window?
    SELECT DISTINCT o.customer_id
    FROM orders o
    WHERE o.status = 'completed'
      AND o.created_at >= (SELECT t FROM cutoff)
      AND o.created_at <  (SELECT t FROM cutoff) + interval '{OUTCOME_WINDOW_DAYS} days'
)
SELECT h.customer_id,
       h.frequency, h.monetary, h.avg_basket, h.recency_days, h.tenure_days,
       CASE WHEN o.customer_id IS NULL THEN 1 ELSE 0 END AS churned
FROM history h
LEFT JOIN outcome o ON o.customer_id = h.customer_id
"""

FEATURES = ["frequency", "monetary", "avg_basket", "recency_days", "tenure_days"]


def load_frame(engine) -> pd.DataFrame:
    with engine.connect() as conn:
        return pd.read_sql(text(FEATURE_SQL), conn)


def train(df: pd.DataFrame) -> None:
    if len(df) < 500:
        print(f"Only {len(df)} rows; not enough to evaluate honestly.")
        return

    X = df[FEATURES].fillna(0.0)
    y = df["churned"]

    base_rate = y.mean()
    print(f"rows: {len(df):,}   churn base rate: {base_rate:.1%}")

    if y.nunique() < 2:
        print("Only one class present — nothing to predict.")
        return

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=200, max_depth=6, min_samples_leaf=50,
        random_state=42, n_jobs=-1,
    )
    model.fit(X_train, y_train)

    probs = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, probs)

    print("\n--- Churn model ---")
    print(classification_report(y_test, model.predict(X_test), digits=3))
    print(f"ROC-AUC: {auc:.3f}")

    print("\nFeature importances:")
    for name, importance in sorted(
        zip(FEATURES, model.feature_importances_), key=lambda kv: -kv[1]
    ):
        print(f"  {name:14} {importance:.3f}")

    print("\n--- Reading of this result ---")
    if auc < 0.58:
        print(
            f"AUC {auc:.3f} is close to chance (0.50). Taken with the data-quality audit,\n"
            "this is the expected result, not a modelling failure: order dates in this\n"
            "seeded dataset are drawn uniformly, so past purchasing genuinely carries no\n"
            "signal about future purchasing. The correct action is to fix the data\n"
            "generator, not to tune the model."
        )
    elif auc > 0.95:
        print(
            f"AUC {auc:.3f} is suspiciously high. On a dataset with flat retention this\n"
            "almost certainly indicates leakage — check that no feature is derived from\n"
            "orders at or after the cutoff."
        )
    else:
        print(f"AUC {auc:.3f} — some signal. Worth inspecting the importances above.")


def main() -> None:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set.")
    engine = create_engine(url)
    df = load_frame(engine)
    train(df)


if __name__ == "__main__":
    main()
