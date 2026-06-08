from tests.e2e.pages.base_page import BasePage


class AdminLessonsPage(BasePage):
    def goto_course(self, course_id: int):
        self.page.goto(f"{self.base_url}/admin/courses/{course_id}")
