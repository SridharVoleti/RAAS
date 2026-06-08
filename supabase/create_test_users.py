"""
Alternative: create the 5 test users via the Supabase admin API (Python).
Use this if the SQL script approach gives permission errors.

Usage:
    pip install supabase python-dotenv
    python supabase/create_test_users.py
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../tests/.env.test"))

SUPABASE_URL = os.getenv("SUPABASE_TEST_URL", "")
SERVICE_KEY  = os.getenv("SUPABASE_TEST_SERVICE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    sys.exit("Set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_KEY in tests/.env.test")

from supabase import create_client

client = create_client(SUPABASE_URL, SERVICE_KEY)

TEST_USERS = [
    {"email": "testuser1@gmail.com", "full_name": "Test User 1"},
    {"email": "testuser2@gmail.com", "full_name": "Test User 2"},
    {"email": "testuser3@gmail.com", "full_name": "Test User 3"},
    {"email": "testuser4@gmail.com", "full_name": "Test User 4"},
    {"email": "testuser5@gmail.com", "full_name": "Test User 5"},
]

PASSWORD = "KrishnaMargam"


def create_users():
    for u in TEST_USERS:
        try:
            result = client.auth.admin.create_user({
                "email": u["email"],
                "password": PASSWORD,
                "email_confirm": True,          # pre-confirms email
                "user_metadata": {
                    "full_name":       u["full_name"],
                    "avatar_initials": "TU",
                    "city":            "Hyderabad",
                    "referral_source": "other",
                },
            })
            user_id = result.user.id
            # Ensure profile_complete = true so they skip /onboarding
            client.table("profiles").update({"profile_complete": True}).eq("id", str(user_id)).execute()
            print(f"  OK    {u['email']}  (id: {user_id})")

        except Exception as e:
            if "already been registered" in str(e) or "duplicate" in str(e).lower():
                print(f"  SKIP  {u['email']} — already exists")
            else:
                print(f"  ERROR {u['email']}: {e}")


def verify():
    print("\nVerification:")
    print(f"  {'Email':<35} {'Name':<15} {'Admin':<7} {'Complete'}")
    print(f"  {'-'*35} {'-'*15} {'-'*7} {'-'*8}")
    users = client.auth.admin.list_users()
    test_emails = {u["email"] for u in TEST_USERS}
    for user in users:
        if user.email in test_emails:
            p = client.table("profiles").select("full_name,is_admin,profile_complete").eq("id", str(user.id)).single().execute()
            if p.data:
                d = p.data
                print(f"  {user.email:<35} {d['full_name']:<15} {str(d['is_admin']):<7} {d['profile_complete']}")


if __name__ == "__main__":
    print("Creating test users...")
    create_users()
    verify()
    print("\nDone. All users have password: KrishnaMargam")
