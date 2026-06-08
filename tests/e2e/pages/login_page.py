from .base_page import BasePage


class LoginPage(BasePage):
    PATH = "/login"
    EMAIL = 'input[type="email"]'
    PASSWORD = 'input[type="password"]'
    SUBMIT = 'button[type="submit"]'
    ERROR_BOX = '[class*="bg-brand-error"]'

    def fill_and_submit(self, email: str, password: str):
        self.goto(self.PATH)
        self.page.fill(self.EMAIL, email)
        self.page.fill(self.PASSWORD, password)
        self.page.click(self.SUBMIT)

    def error_visible(self) -> bool:
        return self.page.locator(self.ERROR_BOX).is_visible()
