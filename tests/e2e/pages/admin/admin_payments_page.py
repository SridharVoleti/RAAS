from tests.e2e.pages.base_page import BasePage


class AdminPaymentsPage(BasePage):
    PATH = "/admin/payments"
    CONFIRM_BTN = 'button:has-text("Confirm")'

    def navigate(self):
        self.goto(self.PATH)
