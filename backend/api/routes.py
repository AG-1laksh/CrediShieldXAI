from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query

from backend.api.security import auth_service, require_roles
from backend.models.schemas import (
    AnalyticsResponse,
    AuthSessionResponse,
    AuthenticatedUser,
    AuditLogsResponse,
    AuditExportResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    BatchPredictionResult,
    CaseCreateRequest,
    CaseListResponse,
    CaseResponse,
    CaseUpdateRequest,
    DocumentAnalyzeRequest,
    DocumentAnalyzeResponse,
    DocumentMismatch,
    FairnessDiagnosticsResponse,
    GoogleLoginRequest,
    GovernanceComparisonResponse,
    ModelRegistryResponse,
    MonitoringResponse,
    MonitoringAlert,
    PredictionRequest,
    PredictionResponse,
    ReportListResponse,
    ReportResponse,
    ReportShareResponse,
)
from backend.services.database_service import DatabaseService
from backend.services.prediction_service import PredictionService

router = APIRouter()
prediction_service = PredictionService()
database_service = DatabaseService()
logger = logging.getLogger("credishield.api.routes")


@router.post("/auth/google-login", response_model=AuthSessionResponse)
def google_login(payload: GoogleLoginRequest) -> AuthSessionResponse:
    try:
        user = auth_service.verify_google_token_and_role(payload.id_token, payload.requested_role)
        token, expires = auth_service.issue_session_token(user)
        return AuthSessionResponse(access_token=token, expires_in_seconds=expires, user=AuthenticatedUser(**user))
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Google login failed: {exc}") from exc


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
def predict_batch(
    payload: BatchPredictionRequest,
    _: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> BatchPredictionResponse:
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
    _: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> AuditLogsResponse:
    payload = database_service.fetch_audit_logs(limit=limit, offset=offset, purpose=purpose)
    return AuditLogsResponse(**payload)


@router.get("/model-registry", response_model=ModelRegistryResponse)
def model_registry(_: AuthenticatedUser = Depends(require_roles("analyst", "admin"))) -> ModelRegistryResponse:
    payload = prediction_service.get_model_registry_info()
    return ModelRegistryResponse(**payload)


@router.get("/fairness", response_model=FairnessDiagnosticsResponse)
def fairness_metrics(_: AuthenticatedUser = Depends(require_roles("analyst", "admin"))) -> FairnessDiagnosticsResponse:
    payload = database_service.fetch_fairness_metrics()
    return FairnessDiagnosticsResponse(**payload)


@router.post("/cases", response_model=CaseResponse)
def create_case(
    payload: CaseCreateRequest,
    user: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> CaseResponse:
    prediction_payload = None
    applicant = payload.applicant_payload.model_dump()

    if payload.auto_predict:
        prediction_payload = prediction_service.predict_with_reason_codes(applicant)
        database_service.log_prediction(applicant, prediction_payload, model_version=prediction_service.model_version)

    case = database_service.create_case(
        created_by=user.email,
        applicant_payload=applicant,
        prediction_payload=prediction_payload,
        assigned_to=payload.assigned_to,
        analyst_notes=payload.analyst_notes,
    )
    return CaseResponse(case=case)


@router.get("/cases", response_model=CaseListResponse)
def list_cases(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    status: str | None = Query(default=None),
    assigned_to: str | None = Query(default=None),
    _: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> CaseListResponse:
    payload = database_service.list_cases(limit=limit, offset=offset, status_filter=status, assigned_to=assigned_to)
    return CaseListResponse(**payload)


@router.get("/cases/{case_id}", response_model=CaseResponse)
def get_case(case_id: int, _: AuthenticatedUser = Depends(require_roles("analyst", "admin"))) -> CaseResponse:
    try:
        case = database_service.get_case(case_id)
        return CaseResponse(case=case)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/cases/{case_id}", response_model=CaseResponse)
def update_case(
    case_id: int,
    payload: CaseUpdateRequest,
    user: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> CaseResponse:
    update_fields = payload.model_dump(exclude_none=True)

    if payload.status in {"approved", "rejected"} and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can finalize case approval/rejection")

    if payload.admin_override_reason and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can set override reason")

    try:
        case = database_service.update_case(case_id, update_fields)
        return CaseResponse(case=case)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/documents/analyze", response_model=DocumentAnalyzeResponse)
def analyze_document(
    payload: DocumentAnalyzeRequest,
    _: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> DocumentAnalyzeResponse:
    text = payload.extracted_text.lower()

    extracted: dict[str, str] = {}
    if payload.doc_type == "salary_slip":
        income_match = re.search(r"(?:salary|income)\s*[:\-]?\s*(\d+[\d,]*)", text)
        if income_match:
            extracted["monthly_income"] = income_match.group(1).replace(",", "")
    elif payload.doc_type == "bank_statement":
        balance_match = re.search(r"(?:balance)\s*[:\-]?\s*(\d+[\d,]*)", text)
        if balance_match:
            extracted["closing_balance"] = balance_match.group(1).replace(",", "")
    elif payload.doc_type == "kyc":
        if "aadhaar" in text:
            extracted["kyc_id_type"] = "aadhaar"
        elif "passport" in text:
            extracted["kyc_id_type"] = "passport"

    mismatches: list[DocumentMismatch] = []
    for key, declared_value in payload.declared_fields.items():
        extracted_value = str(extracted.get(key, ""))
        if extracted_value and str(declared_value) != extracted_value:
            mismatches.append(
                DocumentMismatch(
                    field=key,
                    declared_value=str(declared_value),
                    extracted_value=extracted_value,
                )
            )

    confidence = 0.55 + (0.15 * min(len(extracted), 3))
    if mismatches:
        confidence = max(0.3, confidence - 0.2)

    return DocumentAnalyzeResponse(
        doc_type=payload.doc_type,
        confidence=float(min(confidence, 0.95)),
        extracted_fields=extracted,
        mismatches=mismatches,
    )


@router.get("/monitoring", response_model=MonitoringResponse)
def monitoring(_: AuthenticatedUser = Depends(require_roles("analyst", "admin"))) -> MonitoringResponse:
    logs = database_service.fetch_audit_logs(limit=500, offset=0)
    entries = logs.get("entries", [])

    if not entries:
        return MonitoringResponse(alerts=[], prediction_distribution={"low": 0, "medium": 0, "high": 0})

    pd_values = [float(e["pd_score"]) for e in entries]
    avg_pd = sum(pd_values) / len(pd_values)

    recent = pd_values[: min(100, len(pd_values))]
    baseline = pd_values[min(100, len(pd_values)) :] or pd_values
    recent_avg = sum(recent) / len(recent)
    baseline_avg = sum(baseline) / len(baseline)

    drift = abs(recent_avg - baseline_avg)
    alerts: list[MonitoringAlert] = []
    if drift > 0.08:
        alerts.append(MonitoringAlert(alert_type="data_drift", severity="high", message=f"Recent PD drift is {drift:.3f}"))
    elif drift > 0.04:
        alerts.append(MonitoringAlert(alert_type="data_drift", severity="medium", message=f"Recent PD drift is {drift:.3f}"))

    fairness = database_service.fetch_fairness_metrics()
    by_foreign_worker = fairness.get("by_foreign_worker", [])
    if len(by_foreign_worker) >= 2:
        rates = [float(item["high_risk_rate"]) for item in by_foreign_worker]
        disparity = max(rates) - min(rates)
        if disparity > 0.2:
            alerts.append(MonitoringAlert(alert_type="fairness", severity="high", message=f"High-risk disparity is {disparity:.3f}"))

    distribution = {
        "low": sum(1 for p in pd_values if p < 0.35),
        "medium": sum(1 for p in pd_values if 0.35 <= p < 0.65),
        "high": sum(1 for p in pd_values if p >= 0.65),
        "avg_pd": round(avg_pd, 4),
    }

    return MonitoringResponse(alerts=alerts, prediction_distribution=distribution)


@router.get("/governance/comparison", response_model=GovernanceComparisonResponse)
def governance_comparison(
    challenger_version: str = Query(default="1.1.0"),
    _: AuthenticatedUser = Depends(require_roles("admin")),
) -> GovernanceComparisonResponse:
    logs = database_service.fetch_audit_logs(limit=200, offset=0)
    entries = logs.get("entries", [])
    champion_avg = (
        sum(float(e["pd_score"]) for e in entries) / len(entries)
        if entries
        else 0.5
    )
    challenger_avg = max(0.0, min(1.0, champion_avg - 0.015))
    recommendation = "promote_challenger" if challenger_avg < champion_avg else "keep_champion"

    return GovernanceComparisonResponse(
        champion_model_version=prediction_service.model_version,
        challenger_model_version=challenger_version,
        champion_avg_pd=float(round(champion_avg, 4)),
        challenger_avg_pd=float(round(challenger_avg, 4)),
        recommendation=recommendation,
    )


@router.post("/reports/from-case/{case_id}", response_model=ReportResponse)
def create_report_from_case(
    case_id: int,
    title: str | None = Query(default=None),
    user: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> ReportResponse:
    try:
        report = database_service.create_report_for_case(
            case_id=case_id,
            created_by=user.email,
            title=title or f"Case {case_id} Report",
        )
        return ReportResponse(report=report)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/reports", response_model=ReportListResponse)
def list_reports(
    case_id: int = Query(..., ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> ReportListResponse:
    payload = database_service.list_reports(case_id=case_id, limit=limit, offset=offset)
    return ReportListResponse(**payload)


@router.post("/reports/{report_id}/share", response_model=ReportShareResponse)
def create_report_share_link(
    report_id: int,
    ttl_minutes: int = Query(default=60, ge=1, le=10080),
    user: AuthenticatedUser = Depends(require_roles("analyst", "admin")),
) -> ReportShareResponse:
    try:
        payload = database_service.create_report_share_link(report_id=report_id, created_by=user.email, ttl_minutes=ttl_minutes)
        payload["share_url"] = f"http://127.0.0.1:8000/public/reports/{payload['token']}"
        return ReportShareResponse(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/public/reports/{token}", response_model=ReportResponse)
def read_shared_report(token: str) -> ReportResponse:
    try:
        report = database_service.resolve_report_share_token(token)
        return ReportResponse(report=report)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/reports/audit-package", response_model=AuditExportResponse)
def export_audit_package(
    case_id: int = Query(..., ge=1),
    _: AuthenticatedUser = Depends(require_roles("admin")),
) -> AuditExportResponse:
    try:
        package = database_service.build_audit_export_package(case_id)
        return AuditExportResponse(
            case_id=case_id,
            exported_at=datetime.now(timezone.utc).isoformat(),
            package=package,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
