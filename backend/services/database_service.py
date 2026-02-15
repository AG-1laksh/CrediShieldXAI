from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

DB_PATH = Path("history.db")


class DatabaseService:
    def __init__(self, db_path: Path = DB_PATH) -> None:
        self.db_path = db_path
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _initialize(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    input_json TEXT NOT NULL,
                    pd_score REAL NOT NULL,
                    model_version TEXT NOT NULL DEFAULT '1.0.0',
                    top_risk_increasing_json TEXT NOT NULL,
                    top_risk_decreasing_json TEXT NOT NULL
                )
                """
            )
            columns = {row[1] for row in conn.execute("PRAGMA table_info(predictions)").fetchall()}
            if "model_version" not in columns:
                conn.execute("ALTER TABLE predictions ADD COLUMN model_version TEXT NOT NULL DEFAULT '1.0.0'")

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    assigned_to TEXT,
                    created_by TEXT NOT NULL,
                    applicant_json TEXT NOT NULL,
                    prediction_json TEXT,
                    analyst_notes TEXT,
                    admin_override_reason TEXT
                )
                """
            )
            conn.commit()

    def log_prediction(
        self,
        model_input: Dict[str, Any],
        model_output: Dict[str, Any],
        model_version: str = "1.0.0",
    ) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO predictions (
                    timestamp,
                    input_json,
                    pd_score,
                    model_version,
                    top_risk_increasing_json,
                    top_risk_decreasing_json
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    now_iso,
                    json.dumps(model_input),
                    float(model_output["probability_of_default"]),
                    model_version,
                    json.dumps(model_output["top_risk_increasing"]),
                    json.dumps(model_output["top_risk_decreasing"]),
                ),
            )
            conn.commit()

    def fetch_audit_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        purpose: str | None = None,
    ) -> Dict[str, Any]:
        where_clause = ""
        params: List[Any] = []
        if purpose:
            where_clause = " WHERE json_extract(input_json, '$.purpose') = ?"
            params.append(purpose)

        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            total_row = conn.execute(
                f"SELECT COUNT(*) AS c FROM predictions{where_clause}",
                tuple(params),
            ).fetchone()
            total = int(total_row["c"]) if total_row else 0

            rows = conn.execute(
                f"""
                SELECT id, timestamp, input_json, pd_score, model_version
                FROM predictions
                {where_clause}
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                """,
                tuple([*params, limit, offset]),
            ).fetchall()

        entries = [
            {
                "id": int(row["id"]),
                "timestamp": row["timestamp"],
                "pd_score": float(row["pd_score"]),
                "model_version": row["model_version"] or "1.0.0",
                "input_payload": json.loads(row["input_json"]),
            }
            for row in rows
        ]

        return {
            "total": total,
            "limit": int(limit),
            "offset": int(offset),
            "count": len(entries),
            "entries": entries,
        }

    def fetch_fairness_metrics(self) -> Dict[str, Any]:
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT input_json, pd_score
                FROM predictions
                ORDER BY id DESC
                """
            ).fetchall()

        parsed = [
            {
                "input": json.loads(row["input_json"]),
                "pd_score": float(row["pd_score"]),
            }
            for row in rows
        ]

        def aggregate_by(field: str) -> List[Dict[str, Any]]:
            buckets: Dict[str, Dict[str, Any]] = {}
            for item in parsed:
                key = str(item["input"].get(field, "unknown"))
                if key not in buckets:
                    buckets[key] = {"count": 0, "pd_sum": 0.0, "high": 0}
                buckets[key]["count"] += 1
                buckets[key]["pd_sum"] += item["pd_score"]
                if item["pd_score"] >= 0.5:
                    buckets[key]["high"] += 1

            result: List[Dict[str, Any]] = []
            for group, metrics in buckets.items():
                count = metrics["count"]
                result.append(
                    {
                        "group": group,
                        "count": int(count),
                        "avg_pd": float(metrics["pd_sum"] / count) if count else 0.0,
                        "high_risk_rate": float(metrics["high"] / count) if count else 0.0,
                    }
                )
            return sorted(result, key=lambda x: x["count"], reverse=True)

        return {
            "overall_count": len(parsed),
            "by_personal_status": aggregate_by("personal_status"),
            "by_foreign_worker": aggregate_by("foreign_worker"),
        }

    def fetch_trends(self) -> Dict[str, Any]:
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row

            total = conn.execute("SELECT COUNT(*) AS c FROM predictions").fetchone()["c"]
            latest_row = conn.execute("SELECT MAX(timestamp) AS latest FROM predictions").fetchone()
            last_prediction_at = latest_row["latest"] if latest_row else None

            trend_rows = conn.execute(
                """
                SELECT
                    DATE(timestamp) AS date,
                    COUNT(*) AS prediction_count,
                    AVG(pd_score) AS avg_pd,
                    AVG(CASE WHEN pd_score >= 0.5 THEN 1.0 ELSE 0.0 END) AS high_risk_rate
                FROM predictions
                GROUP BY DATE(timestamp)
                ORDER BY DATE(timestamp) ASC
                """
            ).fetchall()

        trends: List[Dict[str, Any]] = [
            {
                "date": row["date"],
                "prediction_count": int(row["prediction_count"]),
                "avg_pd": float(row["avg_pd"]),
                "high_risk_rate": float(row["high_risk_rate"]),
            }
            for row in trend_rows
        ]

        return {
            "total_predictions": int(total),
            "last_prediction_at": last_prediction_at,
            "trends": trends,
        }

    def create_case(
        self,
        created_by: str,
        applicant_payload: Dict[str, Any],
        prediction_payload: Dict[str, Any] | None,
        assigned_to: str | None = None,
        analyst_notes: str | None = None,
    ) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO cases (
                    created_at,
                    updated_at,
                    status,
                    assigned_to,
                    created_by,
                    applicant_json,
                    prediction_json,
                    analyst_notes,
                    admin_override_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    now_iso,
                    now_iso,
                    "new",
                    assigned_to,
                    created_by,
                    json.dumps(applicant_payload),
                    json.dumps(prediction_payload) if prediction_payload is not None else None,
                    analyst_notes,
                    None,
                ),
            )
            conn.commit()
            case_id = cur.lastrowid

        return self.get_case(case_id)

    def list_cases(
        self,
        limit: int = 50,
        offset: int = 0,
        status_filter: str | None = None,
        assigned_to: str | None = None,
    ) -> Dict[str, Any]:
        where_parts: List[str] = []
        params: List[Any] = []

        if status_filter:
            where_parts.append("status = ?")
            params.append(status_filter)
        if assigned_to:
            where_parts.append("assigned_to = ?")
            params.append(assigned_to)

        where_clause = f" WHERE {' AND '.join(where_parts)}" if where_parts else ""

        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            total_row = conn.execute(
                f"SELECT COUNT(*) AS c FROM cases{where_clause}",
                tuple(params),
            ).fetchone()
            total = int(total_row["c"]) if total_row else 0

            rows = conn.execute(
                f"""
                SELECT *
                FROM cases
                {where_clause}
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                """,
                tuple([*params, limit, offset]),
            ).fetchall()

        entries = [self._row_to_case(r) for r in rows]
        return {
            "total": total,
            "limit": int(limit),
            "offset": int(offset),
            "count": len(entries),
            "entries": entries,
        }

    def get_case(self, case_id: int) -> Dict[str, Any]:
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()

        if row is None:
            raise ValueError(f"Case {case_id} not found")
        return self._row_to_case(row)

    def update_case(self, case_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        allowed = {"status", "assigned_to", "analyst_notes", "admin_override_reason"}
        set_parts: List[str] = []
        params: List[Any] = []

        for key, value in updates.items():
            if key in allowed and value is not None:
                set_parts.append(f"{key} = ?")
                params.append(value)

        set_parts.append("updated_at = ?")
        params.append(datetime.now(timezone.utc).isoformat())
        params.append(case_id)

        if len(set_parts) == 1:
            return self.get_case(case_id)

        with self._connect() as conn:
            conn.execute(
                f"UPDATE cases SET {', '.join(set_parts)} WHERE id = ?",
                tuple(params),
            )
            conn.commit()

        return self.get_case(case_id)

    def _row_to_case(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": int(row["id"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "status": row["status"],
            "assigned_to": row["assigned_to"],
            "created_by": row["created_by"],
            "applicant_payload": json.loads(row["applicant_json"]),
            "prediction_payload": json.loads(row["prediction_json"]) if row["prediction_json"] else None,
            "analyst_notes": row["analyst_notes"],
            "admin_override_reason": row["admin_override_reason"],
        }
