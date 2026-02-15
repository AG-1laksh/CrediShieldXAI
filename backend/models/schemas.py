from __future__ import annotations

from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    checking_status: str
    duration: int = Field(..., ge=1)
    credit_history: str
    purpose: str
    credit_amount: int = Field(..., ge=1)
    savings_status: str
    employment: str
    installment_commitment: int = Field(..., ge=1, le=4)
    personal_status: str
    other_parties: str
    residence_since: int = Field(..., ge=1, le=4)
    property_magnitude: str
    age: int = Field(..., ge=18)
    other_payment_plans: str
    housing: str
    existing_credits: int = Field(..., ge=1)
    job: str
    num_dependents: int = Field(..., ge=1)
    own_telephone: str
    foreign_worker: str


class ReasonCode(BaseModel):
    feature: str
    impact: float


class PredictionResponse(BaseModel):
    probability_of_default: float
    top_risk_increasing: List[ReasonCode]
    top_risk_decreasing: List[ReasonCode]


class AnalyticsTrendPoint(BaseModel):
    date: str
    prediction_count: int
    avg_pd: float
    high_risk_rate: float


class AnalyticsResponse(BaseModel):
    total_predictions: int
    last_prediction_at: datetime | None
    trends: List[AnalyticsTrendPoint]


class AuditLogEntry(BaseModel):
    id: int
    timestamp: datetime
    pd_score: float
    model_version: str
    input_payload: dict


class AuditLogsResponse(BaseModel):
    total: int
    limit: int
    offset: int
    count: int
    entries: List[AuditLogEntry]


class FairnessGroupMetric(BaseModel):
    group: str
    count: int
    avg_pd: float
    high_risk_rate: float


class FairnessDiagnosticsResponse(BaseModel):
    overall_count: int
    by_personal_status: List[FairnessGroupMetric]
    by_foreign_worker: List[FairnessGroupMetric]


class ModelRegistryResponse(BaseModel):
    model_version: str
    artifact_path: str
    last_trained_at: datetime | None
    categorical_features: List[str]
    numerical_features: List[str]


class BatchPredictionRequest(BaseModel):
    items: List[PredictionRequest]


class BatchPredictionResult(BaseModel):
    index: int
    probability_of_default: float
    top_risk_increasing: List[ReasonCode]
    top_risk_decreasing: List[ReasonCode]


class BatchPredictionResponse(BaseModel):
    count: int
    results: List[BatchPredictionResult]


class GoogleLoginRequest(BaseModel):
    id_token: str
    requested_role: Literal["end_user", "analyst", "admin"]


class AuthenticatedUser(BaseModel):
    email: str
    name: str
    picture: str | None = None
    role: Literal["end_user", "analyst", "admin"]
    tenant_id: str = "default"


class AuthSessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: AuthenticatedUser


class CaseRecord(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    status: Literal["new", "under_review", "approved", "rejected"]
    assigned_to: str | None = None
    created_by: str
    applicant_payload: dict
    prediction_payload: dict | None = None
    analyst_notes: str | None = None
    admin_override_reason: str | None = None


class CaseCreateRequest(BaseModel):
    applicant_payload: PredictionRequest
    auto_predict: bool = True
    assigned_to: str | None = None
    analyst_notes: str | None = None


class CaseUpdateRequest(BaseModel):
    status: Literal["new", "under_review", "approved", "rejected"] | None = None
    assigned_to: str | None = None
    analyst_notes: str | None = None
    admin_override_reason: str | None = None


class CaseListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    count: int
    entries: List[CaseRecord]


class CaseResponse(BaseModel):
    case: CaseRecord


class DocumentAnalyzeRequest(BaseModel):
    doc_type: Literal["bank_statement", "salary_slip", "kyc"]
    extracted_text: str
    declared_fields: dict = Field(default_factory=dict)


class DocumentMismatch(BaseModel):
    field: str
    declared_value: str
    extracted_value: str


class DocumentAnalyzeResponse(BaseModel):
    doc_type: str
    confidence: float
    extracted_fields: dict
    mismatches: List[DocumentMismatch]


class MonitoringAlert(BaseModel):
    alert_type: str
    severity: Literal["low", "medium", "high"]
    message: str


class MonitoringResponse(BaseModel):
    alerts: List[MonitoringAlert]
    prediction_distribution: dict


class GovernanceComparisonResponse(BaseModel):
    champion_model_version: str
    challenger_model_version: str
    champion_avg_pd: float
    challenger_avg_pd: float
    recommendation: str


class ReportRecord(BaseModel):
    id: int
    case_id: int
    created_at: datetime
    created_by: str
    title: str
    report_payload: dict


class ReportResponse(BaseModel):
    report: ReportRecord


class ReportListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    count: int
    entries: List[ReportRecord]


class ReportShareResponse(BaseModel):
    report_id: int
    token: str
    expires_at: datetime
    share_url: str


class AuditExportResponse(BaseModel):
    case_id: int
    exported_at: datetime
    package: dict
