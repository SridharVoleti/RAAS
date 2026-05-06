from typing import Any, Dict, Optional

from json_store import JsonStore
from domain import new_id, now_iso, find_one
from security import hash_password, verify_password


USERS_FILE = "users.json"

ADMIN_EMAIL = "sridhar.voleti@gmail.com"
ADMIN_PASSWORD = "admin123"


def ensure_admin_user(store: JsonStore) -> None:
    data = store.read(USERS_FILE, {"users": []})
    users = data.get("users", [])

    existing_admin = find_one(users, lambda u: u.get("role") == "admin")
    if existing_admin:
        email_needs_update = (existing_admin.get("email") or "").lower() != ADMIN_EMAIL.lower()
        password_needs_update = not verify_password(ADMIN_PASSWORD, existing_admin.get("password_hash", ""))
        if email_needs_update or password_needs_update:
            existing_admin["email"] = ADMIN_EMAIL
            existing_admin["password_hash"] = hash_password(ADMIN_PASSWORD)
            store.write(USERS_FILE, {"users": users})
        return

    users.append(
        {
            "id": new_id("usr"),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "referral_code": "ADMIN",
            "referred_by": None,
            "created_at": now_iso(),
        }
    )

    store.write(USERS_FILE, {"users": users})


def create_user(store: JsonStore, email: str, password: str, referral_code: Optional[str]) -> Dict[str, Any]:
    data = store.read(USERS_FILE, {"users": []})
    users = data.get("users", [])

    if find_one(users, lambda u: u.get("email", "").lower() == email.lower()):
        raise ValueError("email_already_registered")

    referred_by = None
    if referral_code:
        ref_user = find_one(users, lambda u: u.get("referral_code") == referral_code)
        if ref_user:
            referred_by = ref_user.get("id")

    user = {
        "id": new_id("usr"),
        "email": email,
        "password_hash": hash_password(password),
        "role": "student",
        "referral_code": new_id("ref"),
        "referred_by": referred_by,
        "created_at": now_iso(),
    }

    users.append(user)
    store.write(USERS_FILE, {"users": users})

    return {k: v for k, v in user.items() if k != "password_hash"}


def authenticate(store: JsonStore, email: str, password: str) -> Optional[Dict[str, Any]]:
    data = store.read(USERS_FILE, {"users": []})
    users = data.get("users", [])

    user = find_one(users, lambda u: u.get("email", "").lower() == email.lower())
    if not user:
        return None

    if not verify_password(password, user.get("password_hash", "")):
        return None

    return {k: v for k, v in user.items() if k != "password_hash"}
