from .base_page import BasePage


class WatchPage(BasePage):
    LESSON_SIDEBAR = '[class*="lesson"], aside, nav[class*="lesson"]'
    VIDEO_PLAYER = 'iframe[src*="youtube"], video, [class*="player"]'
    NOT_ENROLLED_MSG = 'text="Enroll in this course to start watching lessons."'
    PENDING_MSG = 'text="Your enrollment is awaiting confirmation."'
    MARK_COMPLETE_BTN = 'button:has-text("Mark Complete"), button:has-text("Complete")'

    def goto_course(self, slug: str):
        self.page.goto(f"{self.base_url}/watch/{slug}")
