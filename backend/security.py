from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def issue_jwt(payload: Dict[str, Any]) -> str:
    exp_delta: timedelta = current_app.config["JWT_EXP"]
    now = datetime.now(timezone.utc)

    full_payload = {
        **payload,
        "iat": int(now.timestamp()),
        "exp": int((now + exp_delta).timestamp()),
    }

    return jwt.encode(full_payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def decode_jwt(token: str) -> Dict[str, Any]:
    return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])


def get_bearer_token(auth_header: Optional[str]) -> Optional[str]:
    if not auth_header:
        return None
    parts = auth_header.split(" ", 1)
    if len(parts) != 2:
        return None
    if parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None
