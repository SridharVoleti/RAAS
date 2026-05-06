from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from flask import Blueprint, current_app, request, send_file

from certificate_service import generate_certificate_pdf
from course_service import get_course, get_learning_path, list_courses_public, list_learning_paths_public
from domain import new_id, now_iso
from enrollment_service import (
    create_pending_enrollment,
    create_pending_learning_path_enrollment,
    get_enrollment,
    get_learning_path_enrollment,
    list_enrollments,
    submit_payment_confirmation,
    submit_learning_path_payment_confirmation,
)
from json_store import JsonStore
from progress_service import (
    completion_state_for_lessons,
    completion_state_for_sequence,
    list_course_progress,
    record_heartbeat,
)
from security import decode_jwt, get_bearer_token, issue_jwt
from video_crypto import lesson_youtube_id


learner_bp = Blueprint("learner", __name__)


def _store() -> JsonStore:
    return JsonStore(current_app.config["DATA_DIR"])


def _require_user() -> Dict[str, Any]:
    token = get_bearer_token(request.headers.get("Authorization"))
    if not token:
        raise PermissionError("missing_token")
    return decode_jwt(token)


@learner_bp.get("/me")
def me():
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    store = _store()
    enrollments = list_enrollments(store)

    active_learning_paths = [
        e
        for e in enrollments
        if e.get("user_id") == claims.get("sub") and e.get("status") == "active" and e.get("learning_path_id")
    ]

    learning_paths = []
    for e in active_learning_paths:
        lp = get_learning_path(store, e.get("learning_path_id"))
        if not lp:
            continue

        courses = []
        for course_id in lp.get("course_ids", []):
            c = get_course(store, course_id)
            if not c:
                continue
            courses.append(
                {
                    "id": c.get("id"),
                    "title": c.get("title"),
                    "description": c.get("description"),
                }
            )

        learning_paths.append(
            {
                "id": lp.get("id"),
                "title": lp.get("title"),
                "description": lp.get("description"),
                "courses": courses,
            }
        )

    return {
        "user": {"id": claims.get("sub"), "email": claims.get("email"), "role": claims.get("role")},
        "learning_paths": learning_paths,
    }


@learner_bp.get("/courses")
def courses_public():
    return {"courses": list_courses_public(_store())}


@learner_bp.get("/learning-paths")
def learning_paths_public():
    return {"learning_paths": list_learning_paths_public(_store())}


@learner_bp.get("/public/course/<course_id>/outline")
def public_course_outline(course_id: str):
    course = get_course(_store(), course_id)
    if not course:
        return {"error": "course_not_found"}, 404

    lessons = []
    for l in course.get("lessons", []):
        lessons.append({"id": l.get("id"), "title": l.get("title")})

    return {
        "course": {"id": course.get("id"), "title": course.get("title"), "description": course.get("description")},
        "lessons": lessons,
    }


@learner_bp.get("/public/learning-path/<learning_path_id>/outline")
def public_learning_path_outline(learning_path_id: str):
    store = _store()
    learning_path = get_learning_path(store, learning_path_id)
    if not learning_path:
        return {"error": "learning_path_not_found"}, 404

    courses = []
    for course_id in learning_path.get("course_ids", []):
        course = get_course(store, course_id)
        if not course:
            continue

        lessons = []
        for lesson in course.get("lessons", []):
            lessons.append({"id": lesson.get("id"), "title": lesson.get("title")})

        courses.append(
            {
                "id": course.get("id"),
                "title": course.get("title"),
                "description": course.get("description"),
                "lessons": lessons,
            }
        )

    return {
        "learning_path": {
            "id": learning_path.get("id"),
            "title": learning_path.get("title"),
            "description": learning_path.get("description"),
        },
        "courses": courses,
    }


@learner_bp.post("/enroll")
def enroll():
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    course_id = body.get("course_id")

    if not course_id:
        return {"error": "missing_course_id"}, 400

    enrollment = create_pending_enrollment(_store(), claims["sub"], course_id)
    return {"enrollment": enrollment}


@learner_bp.post("/payment/submit")
def submit_payment():
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    course_id = body.get("course_id")
    whatsapp_number = (body.get("whatsapp_number") or "").strip()
    message = (body.get("message") or "").strip()

    if not course_id or not whatsapp_number or not message:
        return {"error": "missing_fields"}, 400

    enrollment = submit_payment_confirmation(_store(), claims["sub"], course_id, whatsapp_number, message)
    return {"enrollment": enrollment}


@learner_bp.post("/learning-path/enroll")
def enroll_learning_path():
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    learning_path_id = body.get("learning_path_id")

    if not learning_path_id:
        return {"error": "missing_learning_path_id"}, 400

    enrollment = create_pending_learning_path_enrollment(_store(), claims["sub"], learning_path_id)
    return {"enrollment": enrollment}


@learner_bp.post("/learning-path/payment/submit")
def submit_learning_path_payment():
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    learning_path_id = body.get("learning_path_id")
    whatsapp_number = (body.get("whatsapp_number") or "").strip()
    message = (body.get("message") or "").strip()

    if not learning_path_id or not whatsapp_number or not message:
        return {"error": "missing_fields"}, 400

    enrollment = submit_learning_path_payment_confirmation(_store(), claims["sub"], learning_path_id, whatsapp_number, message)
    return {"enrollment": enrollment}


def _learning_path_pairs(store: JsonStore, learning_path: Dict[str, Any]):
    ordered_pairs = []
    ordered_course_ids = learning_path.get("course_ids", [])

    for course_id in ordered_course_ids:
        course = get_course(store, course_id)
        if not course:
            continue
        for lesson in course.get("lessons", []):
            ordered_pairs.append((course_id, lesson.get("id")))

    return ordered_pairs


@learner_bp.get("/learning-path/<learning_path_id>/outline")
def learning_path_outline(learning_path_id: str):
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    store = _store()
    learning_path = get_learning_path(store, learning_path_id)
    if not learning_path:
        return {"error": "learning_path_not_found"}, 404

    enrollment = get_learning_path_enrollment(store, claims["sub"], learning_path_id)
    status = enrollment.get("status") if enrollment else "not_enrolled"

    ordered_pairs = _learning_path_pairs(store, learning_path)
    enabled_map, completed_map = completion_state_for_sequence(store, claims["sub"], ordered_pairs)

    courses = []
    for course_id in learning_path.get("course_ids", []):
        course = get_course(store, course_id)
        if not course:
            continue

        lessons = []
        for lesson in course.get("lessons", []):
            key = (course_id, lesson.get("id"))
            lessons.append(
                {
                    "id": lesson.get("id"),
                    "title": lesson.get("title"),
                    "enabled": bool(enabled_map.get(key)) and status == "active",
                    "completed": bool(completed_map.get(key)),
                }
            )

        courses.append(
            {
                "id": course.get("id"),
                "title": course.get("title"),
                "description": course.get("description"),
                "lessons": lessons,
            }
        )

    return {
        "learning_path": {
            "id": learning_path.get("id"),
            "title": learning_path.get("title"),
            "description": learning_path.get("description"),
        },
        "enrollment_status": status,
        "courses": courses,
    }


@learner_bp.post("/learning-path/<learning_path_id>/playback-token")
def learning_path_playback_token(learning_path_id: str):
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    course_id = body.get("course_id")
    lesson_id = body.get("lesson_id")

    if not course_id or not lesson_id:
        return {"error": "missing_fields"}, 400

    store = _store()
    learning_path = get_learning_path(store, learning_path_id)
    if not learning_path:
        return {"error": "learning_path_not_found"}, 404

    enrollment = get_learning_path_enrollment(store, claims["sub"], learning_path_id)
    if not enrollment or enrollment.get("status") != "active":
        return {"error": "not_active"}, 403

    course = get_course(store, course_id)
    if not course:
        return {"error": "course_not_found"}, 404

    lesson = next((l for l in course.get("lessons", []) if l.get("id") == lesson_id), None)
    if not lesson:
        return {"error": "lesson_not_found"}, 404

    youtube_id = lesson_youtube_id(lesson)
    if not youtube_id:
        return {"error": "video_unavailable"}, 400

    ordered_pairs = _learning_path_pairs(store, learning_path)
    enabled_map, _ = completion_state_for_sequence(store, claims["sub"], ordered_pairs)
    if not enabled_map.get((course_id, lesson_id)):
        return {"error": "lesson_locked"}, 403

    exp = datetime.now(timezone.utc) + timedelta(minutes=15)
    token = issue_jwt(
        {
            "typ": "lp_playback",
            "sub": claims["sub"],
            "learning_path_id": learning_path_id,
            "course_id": course_id,
            "lesson_id": lesson_id,
            "youtube_id": youtube_id,
            "exp": int(exp.timestamp()),
        }
    )

    return {"token": token}


@learner_bp.post("/learning-path/<learning_path_id>/heartbeat")
def learning_path_heartbeat(learning_path_id: str):
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    playback_token_str = body.get("playback_token")
    position = body.get("position_seconds")
    duration = body.get("duration_seconds")

    if playback_token_str is None or position is None or duration is None:
        return {"error": "missing_fields"}, 400

    try:
        playback_claims = decode_jwt(playback_token_str)
    except Exception:
        return {"error": "invalid_playback_token"}, 401

    if playback_claims.get("typ") != "lp_playback":
        return {"error": "invalid_playback_token"}, 401

    if playback_claims.get("sub") != claims.get("sub"):
        return {"error": "invalid_playback_token"}, 401

    if playback_claims.get("learning_path_id") != learning_path_id:
        return {"error": "invalid_playback_token"}, 401

    course_id = playback_claims.get("course_id")
    lesson_id = playback_claims.get("lesson_id")

    result = record_heartbeat(
        _store(),
        claims["sub"],
        course_id,
        lesson_id,
        float(position),
        float(duration),
    )

    if not result.accepted:
        return {"error": result.reason}, 400

    return {"ok": True, "completed_now": result.completed_now}


@learner_bp.get("/learning-path/<learning_path_id>/certificate")
def learning_path_certificate(learning_path_id: str):
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    store = _store()
    learning_path = get_learning_path(store, learning_path_id)
    if not learning_path:
        return {"error": "learning_path_not_found"}, 404

    ordered_pairs = _learning_path_pairs(store, learning_path)
    _, completed_map = completion_state_for_sequence(store, claims["sub"], ordered_pairs)

    if ordered_pairs and not all(bool(completed_map.get(pair)) for pair in ordered_pairs):
        return {"error": "learning_path_not_completed"}, 403

    certificate_id = new_id("cert")
    pdf = generate_certificate_pdf(claims.get("email", ""), learning_path.get("title", ""), certificate_id, now_iso())

    from io import BytesIO

    return send_file(
        BytesIO(pdf),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"certificate_learning_path_{learning_path_id}.pdf",
    )


@learner_bp.get("/course/<course_id>/outline")
def course_outline(course_id: str):
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    course = get_course(_store(), course_id)
    if not course:
        return {"error": "course_not_found"}, 404

    enrollment = get_enrollment(_store(), claims["sub"], course_id)
    status = enrollment.get("status") if enrollment else "not_enrolled"

    ordered_lessons = course.get("lessons", [])
    ordered_ids = [l.get("id") for l in ordered_lessons]

    enabled, completed = completion_state_for_lessons(_store(), claims["sub"], course_id, ordered_ids)

    lessons = []
    for l in ordered_lessons:
        lesson_id = l.get("id")
        lessons.append(
            {
                "id": lesson_id,
                "title": l.get("title"),
                "enabled": bool(enabled.get(lesson_id)) and status == "active",
                "completed": bool(completed.get(lesson_id)),
            }
        )

    total_lessons = len(ordered_ids)
    completed_lessons = sum(1 for lesson_id in ordered_ids if bool(completed.get(lesson_id)))
    percent = (completed_lessons / total_lessons) if total_lessons else 0.0

    return {
        "course": {"id": course.get("id"), "title": course.get("title"), "description": course.get("description")},
        "enrollment_status": status,
        "lessons": lessons,
        "progress_summary": {
            "total_lessons": total_lessons,
            "completed_lessons": completed_lessons,
            "percent": percent,
        },
        "progress": list_course_progress(_store(), claims["sub"], course_id),
    }


@learner_bp.post("/course/<course_id>/playback-token")
def playback_token(course_id: str):
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    lesson_id = body.get("lesson_id")

    course = get_course(_store(), course_id)
    if not course:
        return {"error": "course_not_found"}, 404

    enrollment = get_enrollment(_store(), claims["sub"], course_id)
    if not enrollment or enrollment.get("status") != "active":
        return {"error": "not_active"}, 403

    lesson = next((l for l in course.get("lessons", []) if l.get("id") == lesson_id), None)
    if not lesson:
        return {"error": "lesson_not_found"}, 404

    youtube_id = lesson_youtube_id(lesson)
    if not youtube_id:
        return {"error": "video_unavailable"}, 400

    ordered_ids = [l.get("id") for l in course.get("lessons", [])]
    enabled, _ = completion_state_for_lessons(_store(), claims["sub"], course_id, ordered_ids)
    if not enabled.get(lesson_id):
        return {"error": "lesson_locked"}, 403

    exp = datetime.now(timezone.utc) + timedelta(minutes=15)
    token = issue_jwt(
        {
            "typ": "playback",
            "sub": claims["sub"],
            "course_id": course_id,
            "lesson_id": lesson_id,
            "youtube_id": youtube_id,
            "exp": int(exp.timestamp()),
        }
    )

    return {"token": token}


@learner_bp.post("/course/<course_id>/heartbeat")
def heartbeat(course_id: str):
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    body = request.get_json(force=True)
    playback_token_str = body.get("playback_token")
    position = body.get("position_seconds")
    duration = body.get("duration_seconds")

    if playback_token_str is None or position is None or duration is None:
        return {"error": "missing_fields"}, 400

    try:
        playback_claims = decode_jwt(playback_token_str)
    except Exception:
        return {"error": "invalid_playback_token"}, 401

    if playback_claims.get("typ") != "playback":
        return {"error": "invalid_playback_token"}, 401

    if playback_claims.get("sub") != claims.get("sub"):
        return {"error": "invalid_playback_token"}, 401

    if playback_claims.get("course_id") != course_id:
        return {"error": "invalid_playback_token"}, 401

    lesson_id = playback_claims.get("lesson_id")

    result = record_heartbeat(
        _store(),
        claims["sub"],
        course_id,
        lesson_id,
        float(position),
        float(duration),
    )

    if not result.accepted:
        return {"error": result.reason}, 400

    return {"ok": True, "completed_now": result.completed_now}


@learner_bp.get("/course/<course_id>/certificate")
def certificate(course_id: str):
    try:
        claims = _require_user()
    except PermissionError as e:
        return {"error": str(e)}, 401

    course = get_course(_store(), course_id)
    if not course:
        return {"error": "course_not_found"}, 404

    ordered_ids = [l.get("id") for l in course.get("lessons", [])]
    _, completed = completion_state_for_lessons(_store(), claims["sub"], course_id, ordered_ids)

    if ordered_ids and not all(bool(completed.get(lesson_id)) for lesson_id in ordered_ids):
        return {"error": "course_not_completed"}, 403

    certificate_id = new_id("cert")
    pdf = generate_certificate_pdf(claims.get("email", ""), course.get("title", ""), certificate_id, now_iso())

    from io import BytesIO

    return send_file(BytesIO(pdf), mimetype="application/pdf", as_attachment=True, download_name=f"certificate_{course_id}.pdf")
