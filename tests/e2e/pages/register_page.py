from .base_page import BasePage


class RegisterPage(BasePage):
    PATH = "/register"
    FULL_NAME = 'input[name="fullName"]'
    EMAIL = 'input[type="email"]'
    PASSWORD = 'input[name="password"]'
    CONFIRM_PW = 'input[name="confirmPw"]'
    MOBILE = 'input[name="mobile"]'
    REFERRAL = 'select[name="referralSource"]'
    SUBMIT = 'button[type="submit"]'
    ERROR_BOX = '[class*="bg-brand-error"]'

    def navigate(self):
        self.goto(self.PATH)
