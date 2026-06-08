"""
POST /api/auth/register — TC-AUTH-API-05 to 09.

Success:   200  {"success": true}
Bad input: 400  {"error": "<message>"}

Note: duplicate email returns 400 (not 409) because Supabase's error
is re-wrapped by the route handler.
"""

import uuid
import pytest

pytestmark = pytest.mark.auth

_VALID_BASE = {
    "password":       "StrongPass@123",
    "fullName":       "Test Register User",
    "fathersName":    "Father Name",
    "address":        "1 Test Street",
    "city":           "Hyderabad",
    "mobile":         "+919999900001",
    "referralSource": "other",
    "avatarInitials": "TR",
}


def _unique_payload():
    """Returns a valid payload with a guaranteed-unique email."""
    return {**_VALID_BASE, "email": f"reg-{uuid.uuid4().hex[:8]}@test.example.com"}


# TC-AUTH-API-05
def test_valid_registration_returns_success(client):
    r = client.post("/api/auth/register", json=_unique_payload())
    assert r.status_code == 200
    assert r.json().get("success") is True


# TC-AUTH-API-06
def test_empty_body_returns_400(client):
    r = client.post("/api/auth/register", json={})
    assert r.status_code == 400
    assert "error" in r.json()


# TC-AUTH-API-07
def test_missing_email_returns_400(client):
    payload = {k: v for k, v in _unique_payload().items() if k != "email"}
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 400
    assert r.json().get("error") == "Email and password are required"


# TC-AUTH-API-08
def test_missing_password_returns_400(client):
    payload = {k: v for k, v in _unique_payload().items() if k != "password"}
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 400
    assert r.json().get("error") == "Email and password are required"


# TC-AUTH-API-09
def test_duplicate_email_returns_400(client, test_student):
    """Re-registering an existing email returns 400 with an error key."""
    payload = {**_unique_payload(), "email": test_student["email"]}
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 400
    assert "error" in r.json()
