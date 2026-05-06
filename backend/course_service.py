from typing import Any, Dict, List, Optional

from json_store import JsonStore
from domain import find_one


COURSES_FILE = "courses.json"


def list_courses_public(store: JsonStore) -> List[Dict[str, Any]]:
    data = store.read(COURSES_FILE, {"courses": [], "learning_paths": []})
    courses = data.get("courses", [])

    public_courses: List[Dict[str, Any]] = []
    for c in courses:
        public_courses.append(
            {
                "id": c.get("id"),
                "title": c.get("title"),
                "description": c.get("description"),
                "price": c.get("price"),
                "lesson_count": len(c.get("lessons", [])),
            }
        )

    return public_courses


def get_course(store: JsonStore, course_id: str) -> Optional[Dict[str, Any]]:
    data = store.read(COURSES_FILE, {"courses": [], "learning_paths": []})
    courses = data.get("courses", [])
    return find_one(courses, lambda c: c.get("id") == course_id)


def list_learning_paths_public(store: JsonStore) -> List[Dict[str, Any]]:
    data = store.read(COURSES_FILE, {"courses": [], "learning_paths": []})
    paths = data.get("learning_paths", [])

    public_paths: List[Dict[str, Any]] = []
    for p in paths:
        public_paths.append(
            {
                "id": p.get("id"),
                "title": p.get("title"),
                "description": p.get("description"),
                "price": p.get("price"),
                "course_count": len(p.get("course_ids", [])),
            }
        )

    return public_paths


def get_learning_path(store: JsonStore, learning_path_id: str) -> Optional[Dict[str, Any]]:
    data = store.read(COURSES_FILE, {"courses": [], "learning_paths": []})
    paths = data.get("learning_paths", [])
    return find_one(paths, lambda p: p.get("id") == learning_path_id)
