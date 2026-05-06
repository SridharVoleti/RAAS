from __future__ import annotations

from typing import Any, Dict, List

from flask import Blueprint, current_app, request

from domain import new_id, now_iso
from json_store import JsonStore
from security import decode_jwt, get_bearer_token


blog_bp = Blueprint("blog", __name__)

BLOG_INDEX_FILE = "blog/index.json"
BLOG_ARTICLES_DIR = "blog/articles"


def _store() -> JsonStore:
    return JsonStore(current_app.config["DATA_DIR"])


def _require_admin() -> Dict[str, Any]:
    token = get_bearer_token(request.headers.get("Authorization"))
    if not token:
        raise PermissionError("missing_token")
    claims = decode_jwt(token)
    if claims.get("role") != "admin":
        raise PermissionError("not_admin")
    return claims


def _index_default() -> Dict[str, Any]:
    return {"articles": []}


def _article_file(article_id: str) -> str:
    return f"{BLOG_ARTICLES_DIR}/{article_id}.json"


@blog_bp.get("/articles")
def list_articles():
    store = _store()
    index = store.read(BLOG_INDEX_FILE, _index_default())
    articles: List[Dict[str, Any]] = index.get("articles", [])
    return {"articles": articles}


@blog_bp.get("/articles/<article_id>")
def get_article(article_id: str):
    store = _store()
    article = store.read_optional(_article_file(article_id))
    if not article:
        return {"error": "not_found"}, 404
    return {"article": article}


@blog_bp.post("/articles")
def create_article():
    try:
        _require_admin()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    title = (body.get("title") or "").strip()
    content_delta = body.get("content_delta")

    if not title or content_delta is None:
        return {"error": "missing_fields"}, 400

    article_id = new_id("blog")
    created_at = now_iso()

    article = {
        "id": article_id,
        "title": title,
        "content_delta": content_delta,
        "created_at": created_at,
        "updated_at": created_at,
    }

    store = _store()
    store.write(_article_file(article_id), article)

    index = store.read(BLOG_INDEX_FILE, _index_default())
    articles: List[Dict[str, Any]] = index.get("articles", [])
    articles = [a for a in articles if a.get("id") != article_id]
    articles.insert(
        0,
        {
            "id": article_id,
            "title": title,
            "created_at": created_at,
            "updated_at": created_at,
        },
    )

    store.write(BLOG_INDEX_FILE, {"articles": articles})

    return {"article": article}
