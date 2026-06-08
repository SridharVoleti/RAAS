from .base_page import BasePage


class ProfilePage(BasePage):
    PATH = "/profile"
    NAME_INPUT = 'input[name="full_name"], input[name="fullName"]'
    SAVE_BTN = 'button[type="submit"], button:has-text("Save")'

    def navigate(self):
        self.goto(self.PATH)
