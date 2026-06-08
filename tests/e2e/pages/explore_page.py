from .base_page import BasePage


class ExplorePage(BasePage):
    PATH = "/explore"
    COURSE_CARD = '[href*="/courses/"], [class*="course-card"]'
    LEVEL_FILTER = 'select, [role="combobox"]'

    def navigate(self):
        self.goto(self.PATH)

    def course_count(self) -> int:
        return self.page.locator(self.COURSE_CARD).count()
