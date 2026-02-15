from __future__ import annotations

from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.models.schemas import AuthenticatedUser
from backend.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)
auth_service = AuthService()


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        claims = auth_service.decode_session_token(credentials.credentials)
        return AuthenticatedUser(
            email=str(claims.get("email", "")),
            name=str(claims.get("name", "")),
            picture=claims.get("picture"),
            role=claims.get("role"),
            tenant_id=str(claims.get("tenant_id", "default")),
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}") from exc


def require_roles(*roles: str) -> Callable[[AuthenticatedUser], AuthenticatedUser]:
    def dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not authorized. Required one of: {roles}",
            )
        return user

    return dependency
