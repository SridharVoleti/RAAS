from flask import Blueprint, current_app, request

from auth_service import authenticate, create_user, ensure_admin_user
from json_store import JsonStore
from security import issue_jwt


auth_bp = Blueprint("auth", __name__)


def _store() -> JsonStore:
    return JsonStore(current_app.config["DATA_DIR"])


@auth_bp.before_app_request
def _seed_admin():
    ensure_admin_user(_store())


@auth_bp.post("/register")
def register():
    body = request.get_json(force=True)
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    referral_code = (body.get("referral_code") or "").strip() or None

    if not email or not password:
        return {"error": "missing_fields"}, 400

    try:
        user = create_user(_store(), email, password, referral_code)
    except ValueError as e:
        return {"error": str(e)}, 400

    token = issue_jwt({"sub": user["id"], "role": user["role"], "email": user["email"]})
    return {"token": token, "user": user}


@auth_bp.post("/login")
def login():
    body = request.get_json(force=True)
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""

    user = authenticate(_store(), email, password)
    if not user:
        return {"error": "invalid_credentials"}, 401

    token = issue_jwt({"sub": user["id"], "role": user["role"], "email": user["email"]})
    return {"token": token, "user": user}
