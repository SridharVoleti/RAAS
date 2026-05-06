from typing import Any, Dict, List, Optional

from domain import find_one, new_id, now_iso
from json_store import JsonStore


ENROLLMENTS_FILE = "enrollments.json"


def list_enrollments(store: JsonStore) -> List[Dict[str, Any]]:
    data = store.read(ENROLLMENTS_FILE, {"enrollments": []})
    return data.get("enrollments", [])


def get_enrollment(store: JsonStore, user_id: str, course_id: str) -> Optional[Dict[str, Any]]:
    enrollments = list_enrollments(store)
    return find_one(enrollments, lambda e: e.get("user_id") == user_id and e.get("course_id") == course_id)


def get_learning_path_enrollment(store: JsonStore, user_id: str, learning_path_id: str) -> Optional[Dict[str, Any]]:
    enrollments = list_enrollments(store)
    return find_one(
        enrollments,
        lambda e: e.get("user_id") == user_id and e.get("learning_path_id") == learning_path_id,
    )


def create_pending_enrollment(store: JsonStore, user_id: str, course_id: str) -> Dict[str, Any]:
    data = store.read(ENROLLMENTS_FILE, {"enrollments": []})
    enrollments = data.get("enrollments", [])

    existing = find_one(enrollments, lambda e: e.get("user_id") == user_id and e.get("course_id") == course_id)
    if existing:
        return existing

    enrollment = {
        "id": new_id("enr"),
        "user_id": user_id,
        "course_id": course_id,
        "status": "pending",
        "payment": {"whatsapp_number": None, "message": None, "submitted_at": None, "approved_at": None},
        "created_at": now_iso(),
    }

    enrollments.append(enrollment)
    store.write(ENROLLMENTS_FILE, {"enrollments": enrollments})

    return enrollment


def create_pending_learning_path_enrollment(store: JsonStore, user_id: str, learning_path_id: str) -> Dict[str, Any]:
    data = store.read(ENROLLMENTS_FILE, {"enrollments": []})
    enrollments = data.get("enrollments", [])

    existing = find_one(
        enrollments,
        lambda e: e.get("user_id") == user_id and e.get("learning_path_id") == learning_path_id,
    )
    if existing:
        return existing

    enrollment = {
        "id": new_id("enr"),
        "user_id": user_id,
        "course_id": None,
        "learning_path_id": learning_path_id,
        "status": "pending",
        "payment": {"whatsapp_number": None, "message": None, "submitted_at": None, "approved_at": None},
        "created_at": now_iso(),
    }

    enrollments.append(enrollment)
    store.write(ENROLLMENTS_FILE, {"enrollments": enrollments})

    return enrollment


def submit_payment_confirmation(store: JsonStore, user_id: str, course_id: str, whatsapp_number: str, message: str) -> Dict[str, Any]:
    data = store.read(ENROLLMENTS_FILE, {"enrollments": []})
    enrollments = data.get("enrollments", [])

    enrollment = find_one(enrollments, lambda e: e.get("user_id") == user_id and e.get("course_id") == course_id)
    if not enrollment:
        enrollment = create_pending_enrollment(store, user_id, course_id)
        data = store.read(ENROLLMENTS_FILE, {"enrollments": []})
        enrollments = data.get("enrollments", [])
        enrollment = find_one(enrollments, lambda e: e.get("user_id") == user_id and e.get("course_id") == course_id)

    enrollment["payment"] = {
        "whatsapp_number": whatsapp_number,
        "message": message,
        "submitted_at": now_iso(),
        "approved_at": enrollment.get("payment", {}).get("approved_at"),
    }

    store.write(ENROLLMENTS_FILE, {"enrollments": enrollments})
    return enrollment


def submit_learning_path_payment_confirmation(
    store: JsonStore,
    user_id: str,
    learning_path_id: str,
    whatsapp_number: str,
    message: str,
) -> Dict[str, Any]:
    data = store.read(ENROLLMENTS_FILE, {"enrollments": []})
    enrollments = data.get("enrollments", [])

    enrollment = find_one(
        enrollments,
        lambda e: e.get("user_id") == user_id and e.get("learning_path_id") == learning_path_id,
    )
    if not enrollment:
        enrollment = create_pending_learning_path_enrollment(store, user_id, learning_path_id)
        data = store.read(ENROLLMENTS_FILE, {"enrollments": []})
        enrollments = data.get("enrollments", [])
        enrollment = find_one(
            enrollments,
            lambda e: e.get("user_id") == user_id and e.get("learning_path_id") == learning_path_id,
        )

    enrollment["payment"] = {
        "whatsapp_number": whatsapp_number,
        "message": message,
        "submitted_at": now_iso(),
        "approved_at": enrollment.get("payment", {}).get("approved_at"),
    }

    store.write(ENROLLMENTS_FILE, {"enrollments": enrollments})
    return enrollment


def approve_enrollment(store: JsonStore, enrollment_id: str) -> Dict[str, Any]:
    data = store.read(ENROLLMENTS_FILE, {"enrollments": []})
    enrollments = data.get("enrollments", [])

    enrollment = find_one(enrollments, lambda e: e.get("id") == enrollment_id)
    if not enrollment:
        raise ValueError("enrollment_not_found")

    enrollment["status"] = "active"
    payment = enrollment.get("payment", {})
    payment["approved_at"] = now_iso()
    enrollment["payment"] = payment

    store.write(ENROLLMENTS_FILE, {"enrollments": enrollments})
    return enrollment
