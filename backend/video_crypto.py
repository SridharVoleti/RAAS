from __future__ import annotations

from base64 import urlsafe_b64encode
from hashlib import sha256
from typing import Any, Dict, Optional

from urllib.parse import parse_qs, urlparse

from cryptography.fernet import Fernet, InvalidToken
from flask import current_app


def _fernet() -> Fernet:
    secret = current_app.config["SECRET_KEY"]
    if not isinstance(secret, str):
        secret = str(secret)

    key = urlsafe_b64encode(sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_youtube_id(youtube_id: str) -> str:
    return _fernet().encrypt(youtube_id.encode("utf-8")).decode("utf-8")


def decrypt_youtube_id(ciphertext: str) -> Optional[str]:
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


def normalize_youtube_id(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""

    if " " in raw:
        raw = raw.split(" ", 1)[0]

    if raw.startswith("http://") or raw.startswith("https://"):
        u = urlparse(raw)

        host = (u.netloc or "").lower()
        if host == "youtu.be":
            return u.path.strip("/")

        qs = parse_qs(u.query)
        if "v" in qs and qs["v"]:
            return str(qs["v"][0])

        parts = [p for p in u.path.split("/") if p]
        if "embed" in parts:
            i = parts.index("embed")
            if i + 1 < len(parts):
                return parts[i + 1]

        if parts:
            return parts[-1]

    if "watch?v=" in raw:
        return raw.split("watch?v=", 1)[1].split("&", 1)[0]

    if "embed/" in raw:
        return raw.split("embed/", 1)[1].split("?", 1)[0]

    return raw


def lesson_youtube_id(lesson: Dict[str, Any]) -> Optional[str]:
    if "youtube_id_enc" in lesson and lesson.get("youtube_id_enc"):
        dec = decrypt_youtube_id(str(lesson.get("youtube_id_enc")))
        if not dec:
            return None
        return normalize_youtube_id(dec)

    if "youtube_id" in lesson and lesson.get("youtube_id"):
        return normalize_youtube_id(str(lesson.get("youtube_id")))

    return None
