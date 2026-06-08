import os
import pytest
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.test"))


@pytest.fixture(scope="session")
def base_url() -> str:
    url = os.getenv("BASE_URL", "").rstrip("/")
    assert url, "BASE_URL must be set in tests/.env.test"
    return url
