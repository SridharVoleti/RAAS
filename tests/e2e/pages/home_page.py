from .base_page import BasePage


class HomePage(BasePage):
    PATH = "/"
    SIGN_IN_LINK = 'a[href="/login"], button:has-text("Sign In")'
    COURSE_CARD = '[class*="course"], [class*="card"]'
    LANG_TE_BTN = 'button:has-text("తె"), button:has-text("TE")'

    def navigate(self):
        self.goto(self.PATH)
