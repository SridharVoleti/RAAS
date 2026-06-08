from tests.e2e.pages.base_page import BasePage


class AdminStudentsPage(BasePage):
    PATH = "/admin/students"
    TABLE_ROW = 'table tr, [class*="student-row"]'

    def navigate(self):
        self.goto(self.PATH)
