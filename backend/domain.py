import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(10)}"


def find_one(items: List[Dict[str, Any]], predicate) -> Optional[Dict[str, Any]]:
    for item in items:
        if predicate(item):
            return item
    return None
