"""
Admin authentication tests — TC-AUTH-E2E-18 to 21.

Covers: valid admin login, student rejected at admin login,
and unauthenticated access to admin pages.
"""

import pytest
from tests.e2e.pages.admin.admin_login_page import AdminLoginPage

pytestmark = pytest.mark.auth


# TC-AUTH-E2E-18
def test_valid_admin_login_redirects_to_dashboard(anon_page, base_url, test_admin):
    """Admin credentials on /admin/login redirect to /admin."""
    page = AdminLoginPage(anon_page, base_url)
    page.fill_and_submit(test_admin["email"], test_admin["password"])
    anon_page.wait_for_url("**/admin**", timeout=15_000)
    assert "/admin" in anon_page.url
    assert "/admin/login" not in anon_page.url


# TC-AUTH-E2E-19
def test_student_credentials_rejected_at_admin_login(anon_page, base_url, test_student):
    """
    A non-admin user submitting the admin login form must stay on /admin/login.
    Requires test_student to NOT have is_admin=true.
    """
    page = AdminLoginPage(anon_page, base_url)
    page.fill_and_submit(test_student["email"], test_student["password"])
    anon_page.wait_for_timeout(3_000)
    assert "/admin/login" in anon_page.url, (
        "Student should not be allowed into /admin — check is_admin=false for test_student"
    )


# TC-AUTH-E2E-20 / 21
@pytest.mark.parametrize("path", [
    "/admin",
    "/admin/courses",
    "/admin/students",
])
def test_admin_pages_redirect_unauthenticated_to_admin_login(anon_page, base_url, path):
    """All /admin/* pages redirect an unauthenticated visitor to /admin/login."""
    anon_page.goto(f"{base_url}{path}")
    anon_page.wait_for_url("**/admin/login**", timeout=10_000)
    assert "/admin/login" in anon_page.url
