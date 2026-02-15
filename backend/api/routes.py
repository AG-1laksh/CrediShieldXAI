from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi import HTTPException

from backend.models.schemas import AnalyticsResponse, PredictionRequest, PredictionResponse
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
        database_service.log_prediction(payload_dict, prediction)
        return PredictionResponse(**prediction)
    except Exception as exc:
        logger.exception("Prediction pipeline failed. Payload: %s", payload_dict)
        raise HTTPException(status_code=500, detail=f"Prediction pipeline error: {exc}") from exc


@router.get("/analytics", response_model=AnalyticsResponse)
def analytics() -> AnalyticsResponse:
    analytics_payload = database_service.fetch_trends()
    return AnalyticsResponse(**analytics_payload)
