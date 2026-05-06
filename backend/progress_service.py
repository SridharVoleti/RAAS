from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from domain import find_one, now_iso
from json_store import JsonStore


PROGRESS_FILE = "progress.json"


@dataclass
class HeartbeatResult:
    accepted: bool
    completed_now: bool
    reason: Optional[str]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    return datetime.fromisoformat(ts)


def get_progress_row(store: JsonStore, user_id: str, course_id: str, lesson_id: str) -> Optional[Dict[str, Any]]:
    data = store.read(PROGRESS_FILE, {"progress": []})
    rows = data.get("progress", [])
    return find_one(rows, lambda r: r.get("user_id") == user_id and r.get("course_id") == course_id and r.get("lesson_id") == lesson_id)


def upsert_progress_row(store: JsonStore, row: Dict[str, Any]) -> None:
    data = store.read(PROGRESS_FILE, {"progress": []})
    rows = data.get("progress", [])

    existing = find_one(rows, lambda r: r.get("user_id") == row.get("user_id") and r.get("course_id") == row.get("course_id") and r.get("lesson_id") == row.get("lesson_id"))
    if existing:
        existing.update(row)
    else:
        rows.append(row)

    store.write(PROGRESS_FILE, {"progress": rows})


def record_heartbeat(
    store: JsonStore,
    user_id: str,
    course_id: str,
    lesson_id: str,
    position_seconds: float,
    duration_seconds: float,
) -> HeartbeatResult:
    if duration_seconds <= 0:
        return HeartbeatResult(False, False, "invalid_duration")

    if position_seconds < 0:
        return HeartbeatResult(False, False, "invalid_position")

    row = get_progress_row(store, user_id, course_id, lesson_id)

    now = _utc_now()

    existing_duration = float(row.get("duration_seconds", 0.0)) if row else 0.0
    if existing_duration > 0.0:
        if abs(float(duration_seconds) - existing_duration) > 2.0:
            return HeartbeatResult(False, False, "duration_mismatch")

    last_position = float(row.get("max_position_seconds", 0.0)) if row else 0.0
    last_ts = _parse_ts(row.get("last_heartbeat_at")) if row else None

    if last_ts:
        wall_delta = max(0.0, (now - last_ts).total_seconds())
        position_delta = max(0.0, position_seconds - last_position)

        if position_delta > wall_delta + 3.0:
            return HeartbeatResult(False, False, "position_jump_too_large")

    duration_to_use = existing_duration if existing_duration > 0.0 else float(duration_seconds)
    new_max = max(last_position, float(position_seconds))
    ratio = min(1.0, new_max / float(duration_to_use))

    completed_before = bool(row.get("completed")) if row else False
    completed_now = (ratio >= 0.95) and (not completed_before)

    updated_row = {
        "user_id": user_id,
        "course_id": course_id,
        "lesson_id": lesson_id,
        "duration_seconds": float(duration_to_use),
        "max_position_seconds": new_max,
        "ratio": ratio,
        "completed": completed_before or (ratio >= 0.95),
        "last_heartbeat_at": now_iso(),
    }

    upsert_progress_row(store, updated_row)

    return HeartbeatResult(True, completed_now, None)


def list_course_progress(store: JsonStore, user_id: str, course_id: str) -> List[Dict[str, Any]]:
    data = store.read(PROGRESS_FILE, {"progress": []})
    rows = data.get("progress", [])
    return [r for r in rows if r.get("user_id") == user_id and r.get("course_id") == course_id]


def completion_state_for_lessons(
    store: JsonStore,
    user_id: str,
    course_id: str,
    ordered_lesson_ids: List[str],
) -> Tuple[Dict[str, bool], Dict[str, bool]]:
    rows = list_course_progress(store, user_id, course_id)
    completed = {r.get("lesson_id"): bool(r.get("completed")) for r in rows}

    enabled: Dict[str, bool] = {}
    previous_completed = True
    for lesson_id in ordered_lesson_ids:
        enabled[lesson_id] = previous_completed
        previous_completed = previous_completed and bool(completed.get(lesson_id))

    return enabled, completed


def completion_state_for_sequence(
    store: JsonStore,
    user_id: str,
    ordered_pairs: List[Tuple[str, str]],
) -> Tuple[Dict[Tuple[str, str], bool], Dict[Tuple[str, str], bool]]:
    data = store.read(PROGRESS_FILE, {"progress": []})
    rows = data.get("progress", [])

    completed: Dict[Tuple[str, str], bool] = {}
    for r in rows:
        if r.get("user_id") != user_id:
            continue
        key = (r.get("course_id"), r.get("lesson_id"))
        completed[key] = bool(r.get("completed"))

    enabled: Dict[Tuple[str, str], bool] = {}
    previous_completed = True
    for key in ordered_pairs:
        enabled[key] = previous_completed
        previous_completed = previous_completed and bool(completed.get(key))

    return enabled, completed
