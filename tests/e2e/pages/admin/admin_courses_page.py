from tests.e2e.pages.base_page import BasePage


class AdminCoursesPage(BasePage):
    PATH = "/admin/courses"
    NEW_COURSE_BTN = 'button:has-text("New Course"), a:has-text("New Course")'
    DELETE_MODAL_TITLE = 'text="Delete Course"'
    DELETE_CONFIRM_BTN = 'button:has-text("Delete")'
    EMPTY_STATE = 'text="No courses yet."'
    PUBLISHED_TOGGLE = 'button:has-text("Published")'
    DRAFT_TOGGLE = 'button:has-text("Draft")'

    def navigate(self):
        self.goto(self.PATH)
