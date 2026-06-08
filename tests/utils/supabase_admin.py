import os
from supabase import create_client, Client


def get_admin_client() -> Client:
    url = os.getenv("SUPABASE_TEST_URL", "")
    key = os.getenv("SUPABASE_TEST_SERVICE_KEY", "")
    assert url and key, "SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY must be set in tests/.env.test"
    return create_client(url, key)
