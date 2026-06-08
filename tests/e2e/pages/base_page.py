from playwright.sync_api import Page


class BasePage:
    def __init__(self, page: Page, base_url: str):
        self.page = page
        self.base_url = base_url

    def goto(self, path: str = ""):
        self.page.goto(f"{self.base_url}{path}")

    def current_url(self) -> str:
        return self.page.url

    def has_text(self, text: str) -> bool:
        return self.page.get_by_text(text).is_visible()

    def wait_for_url_contains(self, fragment: str, timeout: int = 15_000):
        self.page.wait_for_url(f"**{fragment}**", timeout=timeout)
