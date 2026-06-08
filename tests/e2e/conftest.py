import pytest
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page

from tests.fixtures.users import test_student, test_admin, parallel_users
from tests.fixtures.courses import (
    test_path, test_course, test_lesson,
    test_draft_course, enrolled_student,
)


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


def _login_context(browser: Browser, base_url: str, email: str, password: str) -> BrowserContext:
    """Authenticates via the real login UI and returns a ready browser context."""
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto(f"{base_url}/login")
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_url(lambda url: "/login" not in url, timeout=20_000)
    page.close()
    return ctx


@pytest.fixture(scope="session")
def student_context(browser, base_url, test_student) -> BrowserContext:
    ctx = _login_context(browser, base_url, test_student["email"], test_student["password"])
    yield ctx
    ctx.close()


@pytest.fixture(scope="session")
def admin_context(browser, base_url, test_admin) -> BrowserContext:
    ctx = _login_context(browser, base_url, test_admin["email"], test_admin["password"])
    yield ctx
    ctx.close()


@pytest.fixture
def student_page(student_context: BrowserContext) -> Page:
    page = student_context.new_page()
    yield page
    page.close()


@pytest.fixture
def admin_page(admin_context: BrowserContext) -> Page:
    page = admin_context.new_page()
    yield page
    page.close()


@pytest.fixture
def anon_page(browser: Browser) -> Page:
    """Fresh unauthenticated context per test."""
    ctx = browser.new_context()
    page = ctx.new_page()
    yield page
    page.close()
    ctx.close()
