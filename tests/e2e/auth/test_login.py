"""
Login flow tests — TC-AUTH-E2E-01 to 12.

Covers: valid login, wrong password, unregistered email, empty field
browser validation, returnTo redirect, already-authenticated redirect,
and client-side registration form validation.
"""

import pytest
from tests.e2e.pages.login_page import LoginPage

pytestmark = pytest.mark.auth


class TestValidLogin:

    # TC-AUTH-E2E-01
    def test_valid_login_redirects_away_from_login(self, anon_page, base_url, test_student):
        """Successful login lands the user outside /login."""
        page = LoginPage(anon_page, base_url)
        page.fill_and_submit(test_student["email"], test_student["password"])
        anon_page.wait_for_url(lambda url: "/login" not in url, timeout=15_000)
        assert "/login" not in anon_page.url

    # TC-AUTH-E2E-05
    def test_returnto_param_redirects_after_login(self, anon_page, base_url, test_student):
        """?returnTo=/profile sends the user to /profile after login."""
        anon_page.goto(f"{base_url}/login?returnTo=/profile")
        anon_page.fill('input[type="email"]', test_student["email"])
        anon_page.fill('input[type="password"]', test_student["password"])
        anon_page.click('button[type="submit"]')
        anon_page.wait_for_url("**/profile**", timeout=15_000)
        assert "/profile" in anon_page.url

    # TC-AUTH-E2E-06
    def test_already_authenticated_user_redirected_from_login(self, student_page, base_url):
        """A logged-in user visiting /login should be redirected away."""
        student_page.goto(f"{base_url}/login")
        student_page.wait_for_timeout(2_000)
        assert "/login" not in student_page.url, (
            "Authenticated user should not stay on /login"
        )


class TestLoginErrors:

    # TC-AUTH-E2E-02
    def test_wrong_password_shows_error(self, anon_page, base_url, test_student):
        """Wrong password leaves the user on /login with an error box."""
        page = LoginPage(anon_page, base_url)
        page.fill_and_submit(test_student["email"], "WrongPassword999!")
        anon_page.wait_for_timeout(3_000)
        assert "/login" in anon_page.url
        assert page.error_visible(), "Expected error box (bg-brand-error) to be visible"

    # TC-AUTH-E2E-03
    def test_unregistered_email_shows_error(self, anon_page, base_url):
        """An email that has never been registered shows an error."""
        page = LoginPage(anon_page, base_url)
        page.fill_and_submit("nobody-does-not-exist-xyz@test.example.com", "AnyPass123!")
        anon_page.wait_for_timeout(3_000)
        assert page.error_visible(), "Expected error box for unknown email"

    # TC-AUTH-E2E-04
    def test_empty_email_triggers_browser_validation(self, anon_page, base_url):
        """Submitting with no email fires browser-native validation — no network request sent."""
        page = LoginPage(anon_page, base_url)
        page.goto(page.PATH)
        anon_page.fill(LoginPage.PASSWORD, "SomePassword1!")
        anon_page.click(LoginPage.SUBMIT)
        anon_page.wait_for_timeout(1_000)
        assert "/login" in anon_page.url


class TestRegistrationFormValidation:

    # TC-AUTH-E2E-08
    def test_register_form_renders_required_fields(self, anon_page, base_url):
        """All required fields are present on the registration page."""
        anon_page.goto(f"{base_url}/register")
        anon_page.wait_for_load_state("networkidle")
        assert anon_page.locator('input[type="email"]').is_visible()
        assert anon_page.locator('input[type="password"]').is_visible()
        assert anon_page.locator('input[name="mobile"], input[placeholder*="mobile" i]').is_visible()

    # TC-AUTH-E2E-09
    def test_mismatched_passwords_shows_error(self, anon_page, base_url):
        """Submitting with non-matching passwords shows the mismatch message."""
        anon_page.goto(f"{base_url}/register")
        anon_page.wait_for_load_state("networkidle")
        anon_page.fill('input[name="password"]', "StrongPass@123")
        anon_page.fill('input[name="confirmPw"]', "DifferentPass@456")
        anon_page.click('button[type="submit"]')
        anon_page.wait_for_timeout(1_000)
        assert anon_page.get_by_text("Passwords do not match").is_visible()

    # TC-AUTH-E2E-10
    def test_weak_password_shows_error(self, anon_page, base_url):
        """A single-character password triggers the strength error."""
        anon_page.goto(f"{base_url}/register")
        anon_page.wait_for_load_state("networkidle")
        anon_page.fill('input[name="password"]', "a")
        anon_page.fill('input[name="confirmPw"]', "a")
        anon_page.click('button[type="submit"]')
        anon_page.wait_for_timeout(1_000)
        assert anon_page.get_by_text("Please use a stronger password").is_visible()

    # TC-AUTH-E2E-11
    def test_missing_referral_source_shows_error(self, anon_page, base_url):
        """Submitting without selecting a referral source shows its error."""
        anon_page.goto(f"{base_url}/register")
        anon_page.wait_for_load_state("networkidle")
        anon_page.fill('input[name="fullName"]', "Test Name")
        anon_page.fill('input[type="email"]', "someunique@test.example.com")
        anon_page.fill('input[name="password"]', "StrongPass@123")
        anon_page.fill('input[name="confirmPw"]', "StrongPass@123")
        anon_page.click('button[type="submit"]')
        anon_page.wait_for_timeout(1_000)
        assert anon_page.get_by_text("Please tell us how you heard about us").is_visible()

    # TC-AUTH-E2E-12
    def test_duplicate_email_shows_error(self, anon_page, base_url, test_student):
        """Using an already-registered email shows the duplicate email message."""
        anon_page.goto(f"{base_url}/register")
        anon_page.wait_for_load_state("networkidle")
        anon_page.fill('input[name="fullName"]', "Duplicate User")
        anon_page.fill('input[type="email"]', test_student["email"])
        anon_page.fill('input[name="password"]', "StrongPass@123")
        anon_page.fill('input[name="confirmPw"]', "StrongPass@123")
        anon_page.fill('input[name="mobile"]', "9000000099")

        # Select any referral option
        referral = anon_page.locator('select[name="referralSource"]')
        referral.select_option("other")

        anon_page.click('button[type="submit"]')
        anon_page.wait_for_timeout(4_000)
        assert anon_page.get_by_text("An account with this email already exists.").is_visible()
