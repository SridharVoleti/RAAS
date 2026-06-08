from .base_page import BasePage


class MyCoursesPage(BasePage):
    PATH = "/my-courses"
    COURSE_CARD = '[class*="course"], [class*="card"]'
    PROGRESS_BAR = '[class*="progress"], [role="progressbar"]'

    def navigate(self):
        self.goto(self.PATH)
