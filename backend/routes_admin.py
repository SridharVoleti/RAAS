from flask import Blueprint, current_app, request

from course_service import COURSES_FILE
from course_service import get_course
from excel_import import import_courses_from_xlsx
from enrollment_service import approve_enrollment, list_enrollments
from json_store import JsonStore
from security import decode_jwt, get_bearer_token
from video_crypto import encrypt_youtube_id, lesson_youtube_id, normalize_youtube_id


admin_bp = Blueprint("admin", __name__)


def _store() -> JsonStore:
    return JsonStore(current_app.config["DATA_DIR"])


def _require_admin() -> dict:
    token = get_bearer_token(request.headers.get("Authorization"))
    if not token:
        raise PermissionError("missing_token")
    claims = decode_jwt(token)
    if claims.get("role") != "admin":
        raise PermissionError("not_admin")
    return claims


@admin_bp.get("/enrollments")
def admin_enrollments():
    try:
        _require_admin()
    except PermissionError as e:
        return {"error": str(e)}, 401

    return {"enrollments": list_enrollments(_store())}


@admin_bp.post("/enrollments/<enrollment_id>/approve")
def admin_approve(enrollment_id: str):
    try:
        _require_admin()
    except PermissionError as e:
        return {"error": str(e)}, 401

    try:
        enrollment = approve_enrollment(_store(), enrollment_id)
    except ValueError as e:
        return {"error": str(e)}, 404

    return {"enrollment": enrollment}


@admin_bp.post("/import/courses")
def import_courses():
    try:
        _require_admin()
    except PermissionError as e:
        return {"error": str(e)}, 401

    if "file" not in request.files:
        return {"error": "missing_file"}, 400

    file = request.files["file"]
    xlsx_bytes = file.read()

    try:
        imported = import_courses_from_xlsx(xlsx_bytes)
    except ValueError as e:
        return {"error": str(e)}, 400

    for c in imported.get("courses", []):
        for l in c.get("lessons", []):
            yid = l.get("youtube_id")
            if not yid:
                continue
            l["youtube_id_enc"] = encrypt_youtube_id(normalize_youtube_id(str(yid)))
            if "youtube_id" in l:
                del l["youtube_id"]

    store = _store()
    store.write(COURSES_FILE, imported)

    return {
        "ok": True,
        "course_count": len(imported.get("courses", [])),
        "imported_courses": len(imported.get("courses", [])),
        "imported_learning_paths": len(imported.get("learning_paths", [])),
    }


@admin_bp.get("/courses")
def admin_courses():
    try:
        _require_admin()
    except PermissionError as e:
        return {"error": str(e)}, 401

    data = _store().read(COURSES_FILE, {"courses": [], "learning_paths": []})
    courses = data.get("courses", [])

    out = []
    for c in courses:
        out.append(
            {
                "id": c.get("id"),
                "title": c.get("title"),
                "description": c.get("description"),
                "price": c.get("price"),
                "lesson_count": len(c.get("lessons", [])),
            }
        )

    return {"courses": out}


@admin_bp.get("/courses/<course_id>")
def admin_course_detail(course_id: str):
    try:
        _require_admin()
    except PermissionError as e:
        return {"error": str(e)}, 401

    course = get_course(_store(), course_id)
    if not course:
        return {"error": "not_found"}, 404

    lessons_out = []
    for l in course.get("lessons", []):
        yid = lesson_youtube_id(l)
        lessons_out.append(
            {
                "id": l.get("id"),
                "title": l.get("title"),
                "youtube_id": yid or "",
            }
        )

    course_out = {
        "id": course.get("id"),
        "title": course.get("title"),
        "description": course.get("description"),
        "price": course.get("price"),
        "lessons": lessons_out,
    }

    return {"course": course_out}
