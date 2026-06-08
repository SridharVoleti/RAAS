"""
OTP and password-reset endpoints — TC-AUTH-API-10 to 12.

TC-AUTH-API-10: wrong OTP → 400
TC-AUTH-API-11: send-reset for known email → 200 (no info leak)
TC-AUTH-API-12: send-reset for unknown email → 200 (no info leak)
"""

import pytest

pytestmark = pytest.mark.auth


# TC-AUTH-API-10
def test_wrong_otp_returns_400(client):
    """Submitting an incorrect OTP returns 400 with an error key."""
    r = client.post("/api/auth/verify-mobile-otp", json={
        "mobile": "+919000000099",
        "otp":    "000000",
    })
    assert r.status_code == 400
    assert "error" in r.json()


# TC-AUTH-API-11
def test_send_reset_known_email_returns_200(client, test_student):
    """Password reset request for a registered email returns 200."""
    r = client.post("/api/auth/send-reset", json={"email": test_student["email"]})
    assert r.status_code == 200


# TC-AUTH-API-12
def test_send_reset_unknown_email_returns_200(client):
    """
    Password reset request for an unknown email also returns 200.
    This prevents email enumeration — the response must not differ
    from the known-email case.
    """
    r = client.post("/api/auth/send-reset", json={"email": "nobody-xyz@test.example.com"})
    assert r.status_code == 200
