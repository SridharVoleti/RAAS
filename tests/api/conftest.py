import pytest
import httpx

from tests.fixtures.users import test_student, test_admin, parallel_users
from tests.fixtures.courses import (
    test_path, test_course, test_lesson,
    test_draft_course, enrolled_student,
)


@pytest.fixture(scope="session")
def client(base_url):
    with httpx.Client(base_url=base_url, timeout=30, verify=False) as c:
        yield c


@pytest.fixture(scope="session")
def student_headers(test_student):
    return {"Authorization": f"Bearer {test_student['token']}"}


@pytest.fixture(scope="session")
def admin_headers(test_admin):
    return {"Authorization": f"Bearer {test_admin['token']}"}
