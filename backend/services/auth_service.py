from __future__ import annotations

import os
import json
from urllib.parse import urlencode
from urllib.request import urlopen
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Literal

import jwt


class AuthService:
    def __init__(self) -> None:
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me-in-production")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.jwt_expiry_minutes = int(os.getenv("JWT_EXPIRY_MINUTES", "120"))
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("VITE_GOOGLE_CLIENT_ID")

        analyst_emails = os.getenv("ALLOWED_ANALYST_EMAILS", "")
        admin_emails = os.getenv("ALLOWED_ADMIN_EMAILS", "")
        domains = os.getenv("ALLOWED_ORG_DOMAINS", "")

        self.allowed_analyst_emails = {e.strip().lower() for e in analyst_emails.split(",") if e.strip()}
        self.allowed_admin_emails = {e.strip().lower() for e in admin_emails.split(",") if e.strip()}
        self.allowed_domains = {d.strip().lower() for d in domains.split(",") if d.strip()}

    def _is_role_allowed(self, email: str, role: Literal["end_user", "analyst", "admin"]) -> bool:
        email_l = email.lower()
        domain = email_l.split("@")[-1] if "@" in email_l else ""

        if role == "end_user":
            return True

        if role == "admin":
            if email_l in self.allowed_admin_emails:
                return True
            if self.allowed_domains and domain in self.allowed_domains:
                return True
            return False

        if role == "analyst":
            if email_l in self.allowed_analyst_emails or email_l in self.allowed_admin_emails:
                return True
            if self.allowed_domains and domain in self.allowed_domains:
                return True
            return False

        return False

    def verify_google_token_and_role(
        self,
        raw_id_token: str,
        requested_role: Literal["end_user", "analyst", "admin"],
    ) -> Dict[str, Any]:
        query = urlencode({"id_token": raw_id_token})
        with urlopen(f"https://oauth2.googleapis.com/tokeninfo?{query}", timeout=8) as response:
            idinfo = json.loads(response.read().decode("utf-8"))

        if self.google_client_id and idinfo.get("aud") != self.google_client_id:
            raise ValueError("Google token audience does not match configured client id")

        if str(idinfo.get("email_verified", "false")).lower() not in {"true", "1"}:
            raise ValueError("Google email is not verified")

        email = str(idinfo.get("email", "")).lower()
        if not email:
            raise ValueError("Google token did not include an email")

        if not self._is_role_allowed(email, requested_role):
            raise PermissionError(f"Email '{email}' is not allowed for role '{requested_role}'")

        return {
            "email": email,
            "name": idinfo.get("name") or email,
            "picture": idinfo.get("picture"),
            "role": requested_role,
            "tenant_id": "default",
        }

    def issue_session_token(self, user: Dict[str, Any]) -> tuple[str, int]:
        now = datetime.now(timezone.utc)
        exp = now + timedelta(minutes=self.jwt_expiry_minutes)

        claims = {
            "sub": user["email"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "role": user["role"],
            "tenant_id": user.get("tenant_id", "default"),
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }

        token = jwt.encode(claims, self.jwt_secret, algorithm=self.jwt_algorithm)
        return token, int((exp - now).total_seconds())

    def decode_session_token(self, token: str) -> Dict[str, Any]:
        return jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
