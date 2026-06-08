"""
Session lifecycle tests — TC-AUTH-SESSION-01, 02.

Supabase token TTLs (project defaults):
  access_token:  1 hour  — expires after 2 h inactivity
  refresh_token: 1 week  — still valid at 2 h

Scenario 1 (TC-AUTH-SESSION-01):
  Expired access token + valid refresh token (simulates 2 h inactivity).
  The @supabase/ssr middleware calls getUser() on every request, detects
  the stale access token, and silently exchanges the refresh token for a
  new one. The user is NOT redirected to /login.

Scenario 2 (TC-AUTH-SESSION-02):
  Server-side session fully revoked (admin signOut scope=global).
  getUser() returns null → middleware redirects to /login?returnTo=...
"""

import json
import time
import os
import httpx
import pytest
from tests.utils.supabase_admin import get_admin_client
from tests.e2e.pages.login_page import LoginPage

pytestmark = pytest.mark.auth


# TC-AUTH-SESSION-01
def test_expired_access_token_auto_refreshes(browser, base_url, test_student):
    """
    Inject an expired access_token while keeping the real refresh_token.
    The SSR Supabase client should silently refresh and serve /my-courses.
    """
    supabase_url = os.getenv("SUPABASE_TEST_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_TEST_ANON_KEY", "")

    # Get a real session so we have a valid refresh_token
    r = httpx.post(
        f"{supabase_url}/auth/v1/token",
        params={"grant_type": "password"},
        json={"email": test_student["email"], "password": test_student["password"]},
        headers={"apikey": anon_key},
        timeout=15,
    )
    r.raise_for_status()
    session = r.json()

    # Build a cookie that mimics a 2-hour-old stale state:
    # access_token is deliberately invalid; refresh_token is real.
    project_ref = supabase_url.split("//")[1].split(".")[0]
    cookie_name = f"sb-{project_ref}-auth-token"
    cookie_value = json.dumps({
        **session,
        "access_token": "expired.fake.jwt.token",
        "expires_at": int(time.time()) - 7_200,   # 2 hours ago
    })

    domain = base_url.replace("https://", "").replace("http://", "").rstrip("/").split("/")[0]

    ctx = browser.new_context()
    ctx.add_cookies([{
        "name": cookie_name,
        "value": cookie_value,
        "domain": domain,
        "path": "/",
        "httpOnly": False,
        "secure": True,
        "sameSite": "Lax",
    }])
    page = ctx.new_page()

    page.goto(f"{base_url}/my-courses")
    page.wait_for_load_state("networkidle", timeout=20_000)

    assert "/login" not in page.url, (
        "Expected auto-refresh: user should remain logged in after 2 h inactivity. "
        f"Actual URL: {page.url}"
    )

    page.close()
    ctx.close()


# TC-AUTH-SESSION-02
def test_revoked_session_redirects_to_login(browser, base_url, test_student):
    """
    Log in, revoke the session server-side, then navigate to /my-courses.
    The middleware must redirect to /login?returnTo=/my-courses.
    """
    ctx = browser.new_context()
    page = ctx.new_page()

    # Step 1: Log in via UI
    login = LoginPage(page, base_url)
    login.fill_and_submit(test_student["email"], test_student["password"])
    page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)

    # Step 2: Revoke all sessions server-side
    admin_client = get_admin_client()
    admin_client.auth.admin.sign_out(test_student["id"], scope="global")

    # Step 3: Navigate to a protected route — stale cookies, no valid session
    page.goto(f"{base_url}/my-courses")
    page.wait_for_url("**/login**", timeout=15_000)

    assert "/login" in page.url, "Expected redirect to /login after session revocation"
    assert "returnTo" in page.url, "Expected returnTo parameter in redirect URL"

    page.close()
    ctx.close()
