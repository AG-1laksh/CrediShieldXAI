from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi import HTTPException
from fastapi import Query

from backend.models.schemas import (
    AnalyticsResponse,
    AuditLogsResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    BatchPredictionResult,
    FairnessDiagnosticsResponse,
    ModelRegistryResponse,
    PredictionRequest,
    PredictionResponse,
)
from backend.services.database_service import DatabaseService
from backend.services.prediction_service import PredictionService

router = APIRouter()
prediction_service = PredictionService()
database_service = DatabaseService()
logger = logging.getLogger("credishield.api.routes")


@router.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest) -> PredictionResponse:
    payload_dict = payload.model_dump()
    try:
        prediction = prediction_service.predict_with_reason_codes(payload_dict)
        database_service.log_prediction(payload_dict, prediction, model_version=prediction_service.model_version)
        return PredictionResponse(**prediction)
    except Exception as exc:
        logger.exception("Prediction pipeline failed. Payload: %s", payload_dict)
        raise HTTPException(status_code=500, detail=f"Prediction pipeline error: {exc}") from exc


@router.get("/analytics", response_model=AnalyticsResponse)
def analytics() -> AnalyticsResponse:
    analytics_payload = database_service.fetch_trends()
    return AnalyticsResponse(**analytics_payload)


@router.post("/predict/batch", response_model=BatchPredictionResponse)
def predict_batch(payload: BatchPredictionRequest) -> BatchPredictionResponse:
    results = []
    for idx, item in enumerate(payload.items):
        item_payload = item.model_dump()
        try:
            prediction = prediction_service.predict_with_reason_codes(item_payload)
            database_service.log_prediction(item_payload, prediction, model_version=prediction_service.model_version)
            results.append(
                BatchPredictionResult(
                    index=idx,
                    probability_of_default=float(prediction["probability_of_default"]),
                    top_risk_increasing=prediction["top_risk_increasing"],
                    top_risk_decreasing=prediction["top_risk_decreasing"],
                )
            )
        except Exception as exc:
            logger.exception("Batch prediction failed at index=%s", idx)
            raise HTTPException(status_code=500, detail=f"Batch prediction failed at index {idx}: {exc}") from exc

    return BatchPredictionResponse(count=len(results), results=results)


@router.get("/audit-logs", response_model=AuditLogsResponse)
def audit_logs(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    purpose: str | None = Query(default=None),
) -> AuditLogsResponse:
    payload = database_service.fetch_audit_logs(limit=limit, offset=offset, purpose=purpose)
    return AuditLogsResponse(**payload)


@router.get("/model-registry", response_model=ModelRegistryResponse)
def model_registry() -> ModelRegistryResponse:
    payload = prediction_service.get_model_registry_info()
    return ModelRegistryResponse(**payload)


@router.get("/fairness", response_model=FairnessDiagnosticsResponse)
def fairness_metrics() -> FairnessDiagnosticsResponse:
    payload = database_service.fetch_fairness_metrics()
    return FairnessDiagnosticsResponse(**payload)
