from tests.e2e.pages.base_page import BasePage


class AdminDashboardPage(BasePage):
    PATH = "/admin"
    STATS_CARD = '[class*="stat"], [class*="card"]'

    def navigate(self):
        self.goto(self.PATH)
