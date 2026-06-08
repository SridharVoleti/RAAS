"""
POST /api/auth/check-email — TC-AUTH-API-01 to 04.

Response shape: {"exists": bool}
"""

import pytest

pytestmark = pytest.mark.auth


# TC-AUTH-API-01
def test_new_email_returns_exists_false(client):
    r = client.post("/api/auth/check-email", json={"email": "brand-new-xyz-99@test.example.com"})
    assert r.status_code == 200
    assert r.json() == {"exists": False}


# TC-AUTH-API-02
def test_existing_email_returns_exists_true(client, test_student):
    r = client.post("/api/auth/check-email", json={"email": test_student["email"]})
    assert r.status_code == 200
    assert r.json() == {"exists": True}


# TC-AUTH-API-03
def test_missing_email_field_returns_400(client):
    r = client.post("/api/auth/check-email", json={})
    assert r.status_code == 400
    assert r.json().get("error") == "Email is required"


# TC-AUTH-API-04
def test_invalid_email_format_returns_400(client):
    r = client.post("/api/auth/check-email", json={"email": "not-an-email"})
    assert r.status_code == 400
    assert "error" in r.json()
