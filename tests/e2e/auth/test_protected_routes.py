"""
Protected route redirect tests — TC-AUTH-E2E-13 to 17.

Every protected route must redirect an unauthenticated visitor to
/login?returnTo=<original path>.
"""

import pytest

pytestmark = pytest.mark.auth


@pytest.mark.parametrize("path", [
    "/my-courses",
    "/profile",
])
def test_protected_route_redirects_with_returnto(anon_page, base_url, path):
    """Standard protected routes redirect to /login with returnTo."""
    anon_page.goto(f"{base_url}{path}")
    anon_page.wait_for_url("**/login**", timeout=10_000)
    assert "/login" in anon_page.url
    assert f"returnTo={path}" in anon_page.url


def test_watch_redirects_with_returnto(anon_page, base_url, test_course):
    """TC-AUTH-E2E-14: /watch/[slug] redirects with the correct returnTo slug."""
    slug = test_course["slug"]
    anon_page.goto(f"{base_url}/watch/{slug}")
    anon_page.wait_for_url("**/login**", timeout=10_000)
    assert "/login" in anon_page.url
    assert f"returnTo=/watch/{slug}" in anon_page.url


def test_payment_redirects_unauthenticated(anon_page, base_url, test_course):
    """TC-AUTH-E2E-16: /payment/[id] redirects to /login."""
    course_id = test_course["id"]
    anon_page.goto(f"{base_url}/payment/{course_id}")
    anon_page.wait_for_url("**/login**", timeout=10_000)
    assert "/login" in anon_page.url


def test_certificate_redirects_unauthenticated(anon_page, base_url, test_course):
    """TC-AUTH-E2E-17: /certificate/[id] redirects to /login."""
    course_id = test_course["id"]
    anon_page.goto(f"{base_url}/certificate/{course_id}")
    anon_page.wait_for_url("**/login**", timeout=10_000)
    assert "/login" in anon_page.url
