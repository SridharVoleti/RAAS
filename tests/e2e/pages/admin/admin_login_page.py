from tests.e2e.pages.base_page import BasePage


class AdminLoginPage(BasePage):
    PATH = "/admin/login"
    EMAIL = 'input[type="email"]'
    PASSWORD = 'input[type="password"]'
    SUBMIT = 'button[type="submit"]'

    def fill_and_submit(self, email: str, password: str):
        self.goto(self.PATH)
        self.page.fill(self.EMAIL, email)
        self.page.fill(self.PASSWORD, password)
        self.page.click(self.SUBMIT)
