"""
Logout flow tests — TC-AUTH-E2E-07, 07b.

Each test signs in fresh (anon_page) so logout does not affect
the shared student_context used by other test files.
"""

import pytest
from tests.e2e.pages.login_page import LoginPage

pytestmark = pytest.mark.auth

# Selectors for the logout control in the navbar
LOGOUT_SELECTOR = (
    'button:has-text("Sign Out"), '
    'button:has-text("Logout"), '
    'a:has-text("Sign Out"), '
    'a:has-text("Logout")'
)


def _sign_in(page, base_url, email, password):
    login = LoginPage(page, base_url)
    login.fill_and_submit(email, password)
    page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)


# TC-AUTH-E2E-07
def test_logout_shows_sign_in_in_navbar(anon_page, base_url, test_student):
    """After logout the navbar reverts to showing the Sign In link."""
    _sign_in(anon_page, base_url, test_student["email"], test_student["password"])

    anon_page.locator(LOGOUT_SELECTOR).first.click()
    anon_page.wait_for_timeout(2_000)

    assert anon_page.get_by_text("Sign In").is_visible(), (
        "Expected 'Sign In' to appear in navbar after logout"
    )


# TC-AUTH-E2E-07b
def test_logout_then_protected_route_redirects_to_login(anon_page, base_url, test_student):
    """After logout, navigating to /my-courses redirects to /login."""
    _sign_in(anon_page, base_url, test_student["email"], test_student["password"])

    anon_page.locator(LOGOUT_SELECTOR).first.click()
    anon_page.wait_for_timeout(2_000)

    anon_page.goto(f"{base_url}/my-courses")
    anon_page.wait_for_url("**/login**", timeout=10_000)
    assert "/login" in anon_page.url, "Expected redirect to /login after logout"
