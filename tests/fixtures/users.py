import os
import pytest
from tests.utils.auth import get_token
from tests.utils.supabase_admin import get_admin_client


@pytest.fixture(scope="session")
def test_student():
    """Primary student account — read from .env.test, never created or deleted by tests."""
    email = os.getenv("TEST_STUDENT_EMAIL", "")
    password = os.getenv("TEST_STUDENT_PASSWORD", "")
    assert email and password, "TEST_STUDENT_EMAIL / TEST_STUDENT_PASSWORD must be set in tests/.env.test"

    token = get_token(email, password)

    client = get_admin_client()
    users = client.auth.admin.list_users()
    user = next((u for u in users if u.email == email), None)
    assert user, f"User {email} not found in Supabase — run create_test_users.sql first"

    return {"id": str(user.id), "email": email, "password": password, "token": token}


@pytest.fixture(scope="session")
def test_admin():
    """Primary admin account (sridhar.voleti@gmail.com) — read from .env.test."""
    email = os.getenv("TEST_ADMIN_EMAIL", "")
    password = os.getenv("TEST_ADMIN_PASSWORD", "")
    assert email and password, "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD must be set in tests/.env.test"

    token = get_token(email, password)
    return {"email": email, "password": password, "token": token}


@pytest.fixture(scope="session")
def parallel_users():
    """
    All 5 parallel test accounts as a list.
    testuser5 is admin; testuser1–4 are students.
    """
    password = os.getenv("TEST_PARALLEL_PASSWORD", "KrishnaMargam")
    emails = [
        os.getenv("TEST_USER1_EMAIL", "testuser1@gmail.com"),
        os.getenv("TEST_USER2_EMAIL", "testuser2@gmail.com"),
        os.getenv("TEST_USER3_EMAIL", "testuser3@gmail.com"),
        os.getenv("TEST_USER4_EMAIL", "testuser4@gmail.com"),
        os.getenv("TEST_USER5_EMAIL", "testuser5@gmail.com"),
    ]
    users = []
    client = get_admin_client()
    all_users = client.auth.admin.list_users()
    user_map = {u.email: u for u in all_users}

    for email in emails:
        assert email in user_map, f"{email} not found — run create_test_users.sql first"
        token = get_token(email, password)
        users.append({
            "id": str(user_map[email].id),
            "email": email,
            "password": password,
            "token": token,
        })
    return users
