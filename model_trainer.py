from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from imblearn.over_sampling import SMOTE
from sklearn.compose import ColumnTransformer
from sklearn.datasets import fetch_openml
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier


ARTIFACT_DIR = Path("models")
ARTIFACT_PATH = ARTIFACT_DIR / "credit_risk_bundle.joblib"
TARGET_COLUMN = "default"
RANDOM_STATE = 42

_bundle_cache: Dict[str, Any] | None = None


def _load_dataset() -> Tuple[pd.DataFrame, pd.Series]:
    """Load German Credit dataset from OpenML.

    The OpenML target values are usually {"good", "bad"}; we map "bad" to 1
    to represent probability of default (PD).
    """
    dataset = fetch_openml(name="credit-g", version=1, as_frame=True)
    features = dataset.data.copy()
    target = dataset.target.astype(str).str.lower().map({"bad": 1, "good": 0})

    if target.isna().any():
        raise ValueError("Unexpected target values in credit-g dataset.")

    return features, target.astype(int)


def _build_preprocessor(
    features: pd.DataFrame,
) -> Tuple[ColumnTransformer, List[str], List[str]]:
    categorical_features = features.select_dtypes(include=["object", "category"]).columns.tolist()
    numerical_features = [c for c in features.columns if c not in categorical_features]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numerical_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ],
        remainder="drop",
    )
    return preprocessor, categorical_features, numerical_features


def _build_feature_map(
    feature_names: List[str],
    categorical_features: List[str],
    numerical_features: List[str],
) -> Dict[str, str]:
    """Map transformed feature names back to base business feature names."""
    feature_map: Dict[str, str] = {}

    # Numeric features are straightforward: num__feature_name
    for col in numerical_features:
        transformed_name = f"num__{col}"
        feature_map[transformed_name] = col

    # Categorical one-hot outputs look like cat__<column>_<category>
    for transformed_name in feature_names:
        if transformed_name.startswith("cat__"):
            stripped = transformed_name.removeprefix("cat__")
            mapped = stripped
            for col in categorical_features:
                prefix = f"{col}_"
                if stripped == col or stripped.startswith(prefix):
                    mapped = col
                    break
            feature_map[transformed_name] = mapped
        elif transformed_name.startswith("num__") and transformed_name not in feature_map:
            feature_map[transformed_name] = transformed_name.removeprefix("num__")
        else:
            feature_map[transformed_name] = transformed_name

    return feature_map


def train_and_save_model(output_path: Path = ARTIFACT_PATH) -> Dict[str, float]:
    """Train the model and persist preprocessor + estimator artifacts."""
    features, target = _load_dataset()

    X_train, X_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=target,
    )

    preprocessor, categorical_features, numerical_features = _build_preprocessor(features)

    X_train_transformed = preprocessor.fit_transform(X_train)
    X_test_transformed = preprocessor.transform(X_test)

    smote = SMOTE(random_state=RANDOM_STATE)
    X_resampled, y_resampled = smote.fit_resample(X_train_transformed, y_train)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        random_state=RANDOM_STATE,
        eval_metric="logloss",
    )
    model.fit(X_resampled, y_resampled)

    y_pred_proba = model.predict_proba(X_test_transformed)[:, 1]
    auc = roc_auc_score(y_test, y_pred_proba)

    feature_names = preprocessor.get_feature_names_out().tolist()
    base_feature_map = _build_feature_map(feature_names, categorical_features, numerical_features)

    bundle = {
        "preprocessor": preprocessor,
        "model": model,
        "feature_names": feature_names,
        "base_feature_map": base_feature_map,
        "categorical_features": categorical_features,
        "numerical_features": numerical_features,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, output_path)

    global _bundle_cache
    _bundle_cache = bundle

    return {"roc_auc": float(auc)}


def load_bundle(artifact_path: Path = ARTIFACT_PATH) -> Dict[str, Any]:
    global _bundle_cache
    if _bundle_cache is not None:
        return _bundle_cache

    if not artifact_path.exists():
        train_and_save_model(output_path=artifact_path)

    try:
        loaded = joblib.load(artifact_path)
        if isinstance(loaded, dict):
            _bundle_cache = loaded
        else:
            # Legacy artifact format (custom class); retrain to normalize.
            train_and_save_model(output_path=artifact_path)
    except Exception:
        # Corrupt/incompatible artifact fallback
        train_and_save_model(output_path=artifact_path)

    if _bundle_cache is None:
        _bundle_cache = joblib.load(artifact_path)

    return _bundle_cache


def _aggregate_shap_by_base_feature(
    shap_values_row: np.ndarray,
    feature_names: List[str],
    feature_map: Dict[str, str],
) -> Dict[str, float]:
    aggregated: Dict[str, float] = {}
    for transformed_name, shap_val in zip(feature_names, shap_values_row):
        base_feature = feature_map.get(transformed_name, transformed_name)
        aggregated[base_feature] = aggregated.get(base_feature, 0.0) + float(shap_val)
    return aggregated


def _compute_shap_values_row(bundle: Dict[str, Any], transformed: Any) -> np.ndarray:
    """Compute one-row SHAP contributions with a resilient fallback path.

    Primary path: shap.TreeExplainer
    Fallback path: XGBoost pred_contribs (SHAP-compatible contributions)
    """
    model = bundle["model"]

    try:
        explainer = shap.TreeExplainer(model)
        shap_result = explainer.shap_values(transformed)
        if isinstance(shap_result, list):
            return np.asarray(shap_result[-1])[0]
        return np.asarray(shap_result)[0]
    except Exception:
        dmatrix = xgb.DMatrix(transformed)
        contribs = model.get_booster().predict(dmatrix, pred_contribs=True)
        # Last column is bias term; exclude to align with transformed feature names.
        return np.asarray(contribs)[0][:-1]


def get_explanation(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Return PD and top-3 risk-increasing/decreasing SHAP reason codes.

    Args:
        input_data: Single applicant payload with keys matching German Credit
            feature names.

    Returns:
        {
          "probability_of_default": <float>,
          "top_risk_increasing": [{"feature": ..., "impact": ...}, ...],
          "top_risk_decreasing": [{"feature": ..., "impact": ...}, ...]
        }
    """
    bundle = load_bundle()

    input_df = pd.DataFrame([input_data])
    transformed = bundle["preprocessor"].transform(input_df)

    pd_score = float(bundle["model"].predict_proba(transformed)[0, 1])

    shap_values_row = _compute_shap_values_row(bundle=bundle, transformed=transformed)

    aggregated = _aggregate_shap_by_base_feature(
        shap_values_row=shap_values_row,
        feature_names=bundle["feature_names"],
        feature_map=bundle["base_feature_map"],
    )

    sorted_impacts = sorted(aggregated.items(), key=lambda kv: kv[1], reverse=True)
    top_increasing = [
        {"feature": feature, "impact": float(impact)}
        for feature, impact in [item for item in sorted_impacts if item[1] > 0][:3]
    ]
    top_decreasing = [
        {"feature": feature, "impact": float(impact)}
        for feature, impact in [item for item in sorted_impacts[::-1] if item[1] < 0][:3]
    ]

    return {
        "probability_of_default": pd_score,
        "top_risk_increasing": top_increasing,
        "top_risk_decreasing": top_decreasing,
    }


def get_training_schema() -> Dict[str, List[str]]:
    bundle = load_bundle()
    return {
        "categorical_features": bundle["categorical_features"],
        "numerical_features": bundle["numerical_features"],
    }


if __name__ == "__main__":
    metrics = train_and_save_model()
    print(f"Model trained and saved to {ARTIFACT_PATH} | ROC-AUC: {metrics['roc_auc']:.4f}")
