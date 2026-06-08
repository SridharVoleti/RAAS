import os
import httpx


def get_token(email: str, password: str) -> str:
    supabase_url = os.getenv("SUPABASE_TEST_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_TEST_ANON_KEY", "")
    r = httpx.post(
        f"{supabase_url}/auth/v1/token",
        params={"grant_type": "password"},
        json={"email": email, "password": password},
        headers={"apikey": anon_key},
        timeout=15,
        verify=False,
    )
    r.raise_for_status()
    return r.json()["access_token"]
