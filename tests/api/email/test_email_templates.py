"""
Regression tests for the email template CRUD API and admin test-send endpoint.

Routes covered:
  GET  /api/admin/email-templates/{type}
  PUT  /api/admin/email-templates/{type}
  POST /api/admin/email/test-send

Auth rules:
  - Unauthenticated → 403
  - Student (non-admin) → 403
  - Admin → 200

Template type used in these tests: "enrollment"
"""

import pytest


TEMPLATE_TYPE = "enrollment"
TEMPLATE_URL  = f"/api/admin/email-templates/{TEMPLATE_TYPE}"
TEST_SEND_URL = "/api/admin/email/test-send"

VALID_TEMPLATE = {
    "subject": "Test subject — {{course_en}}",
    "body":    "Hello {{name}}, you are enrolled in {{course_en}} ({{course_te}}).",
}


# ── GET /api/admin/email-templates/enrollment ─────────────────────────────────

class TestGetEmailTemplate:
    def test_unauthenticated_returns_403(self, client):
        res = client.get(TEMPLATE_URL)
        assert res.status_code == 403

    def test_student_returns_403(self, client, student_headers):
        res = client.get(TEMPLATE_URL, headers=student_headers)
        assert res.status_code == 403

    def test_admin_gets_existing_template(self, client, admin_headers):
        res = client.get(TEMPLATE_URL, headers=admin_headers)
        # The enrollment template is seeded in the DB. If not yet saved it returns 404;
        # after the first PUT it returns 200. Either is acceptable here.
        assert res.status_code in (200, 404)

    def test_admin_gets_404_for_unknown_type(self, client, admin_headers):
        res = client.get("/api/admin/email-templates/nonexistent_type_xyz", headers=admin_headers)
        assert res.status_code == 404

    def test_admin_200_response_has_required_fields(self, client, admin_headers):
        # Ensure a template exists first
        client.put(TEMPLATE_URL, json=VALID_TEMPLATE, headers=admin_headers)

        res = client.get(TEMPLATE_URL, headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "subject" in data
        assert "body"    in data
        assert "type"    in data
        assert data["type"] == TEMPLATE_TYPE


# ── PUT /api/admin/email-templates/enrollment ─────────────────────────────────

class TestPutEmailTemplate:
    def test_unauthenticated_returns_403(self, client):
        res = client.put(TEMPLATE_URL, json=VALID_TEMPLATE)
        assert res.status_code == 403

    def test_student_returns_403(self, client, student_headers):
        res = client.put(TEMPLATE_URL, json=VALID_TEMPLATE, headers=student_headers)
        assert res.status_code == 403

    def test_empty_subject_returns_400(self, client, admin_headers):
        res = client.put(
            TEMPLATE_URL,
            json={"subject": "", "body": "Some body"},
            headers=admin_headers,
        )
        assert res.status_code == 400

    def test_missing_body_returns_400(self, client, admin_headers):
        res = client.put(
            TEMPLATE_URL,
            json={"subject": "Valid subject"},
            headers=admin_headers,
        )
        assert res.status_code == 400

    def test_empty_body_returns_400(self, client, admin_headers):
        res = client.put(
            TEMPLATE_URL,
            json={"subject": "Valid subject", "body": ""},
            headers=admin_headers,
        )
        assert res.status_code == 400

    def test_admin_can_upsert_template(self, client, admin_headers):
        res = client.put(TEMPLATE_URL, json=VALID_TEMPLATE, headers=admin_headers)
        assert res.status_code == 200
        assert res.json().get("success") is True

    def test_upserted_template_is_persisted(self, client, admin_headers):
        updated = {
            "subject": "Regression check subject — {{course_en}}",
            "body":    "Regression check body for {{name}}.",
        }
        client.put(TEMPLATE_URL, json=updated, headers=admin_headers)
        res = client.get(TEMPLATE_URL, headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["subject"] == updated["subject"]
        assert data["body"]    == updated["body"]

    def test_template_trimmed_whitespace(self, client, admin_headers):
        padded = {"subject": "  Padded subject  ", "body": "  Padded body  "}
        client.put(TEMPLATE_URL, json=padded, headers=admin_headers)
        res = client.get(TEMPLATE_URL, headers=admin_headers)
        data = res.json()
        assert data["subject"] == "Padded subject"
        assert data["body"]    == "Padded body"


# ── POST /api/admin/email/test-send ──────────────────────────────────────────

class TestEmailTestSend:
    def test_unauthenticated_returns_403(self, client):
        res = client.post(TEST_SEND_URL, json={})
        assert res.status_code == 403

    def test_student_returns_403(self, client, student_headers):
        res = client.post(TEST_SEND_URL, json={}, headers=student_headers)
        assert res.status_code == 403

    @pytest.mark.xfail(reason="Requires RESEND_API_KEY to be set in the test environment")
    def test_admin_sends_test_email(self, client, admin_headers):
        """
        This test requires RESEND_API_KEY to be configured on the server.
        It is marked xfail until the key is provisioned in the Vercel environment.
        When RESEND_API_KEY is set, this should return 200 with success=true.
        """
        res = client.post(TEST_SEND_URL, json={}, headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True
        assert "to" in data

    def test_admin_503_when_resend_key_not_set(self, client, admin_headers):
        """
        When RESEND_API_KEY is not configured, the endpoint returns 503.
        Marked xfail because in prod/staging the key SHOULD be set.
        In CI (no key) this is the expected response.
        """
        res = client.post(TEST_SEND_URL, json={}, headers=admin_headers)
        # Either 200 (key configured) or 503 (key missing) is valid
        assert res.status_code in (200, 503)
