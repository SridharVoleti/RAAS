# Krishnamargam — Regression Test Suite Progress

## Overview
End-to-end and API regression test suite using **Playwright + pytest**, targeting the staging Vercel URL with a dedicated Supabase test project.

**Total test cases: 155** (145 active, 10 xfail pending Razorpay/email integration)

---

## Test Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Student (primary) | `voletis17@gmail.com` | `Krishnamargam` | Regular user, not admin |
| Admin | `sridhar.voleti@gmail.com` | `Krishnamargam` | Already promoted via `supabase/promote_sridhar_admin.sql` |
| Parallel test user 1 | `testuser1@gmail.com` | `KrishnaMargam` | Created via `create_test_users.sql` |
| Parallel test user 2 | `testuser2@gmail.com` | `KrishnaMargam` | Created via `create_test_users.sql` |
| Parallel test user 3 | `testuser3@gmail.com` | `KrishnaMargam` | Created via `create_test_users.sql` |
| Parallel test user 4 | `testuser4@gmail.com` | `KrishnaMargam` | Created via `create_test_users.sql` |
| Parallel test user 5 (admin) | `testuser5@gmail.com` | `KrishnaMargam` | Admin — promoted via `promote_testuser5_admin.sql` |

> Store credentials in `tests/.env.test` (never commit this file).
> Note: Primary student/admin use `Krishnamargam`; parallel test users use `KrishnaMargam` (capital M).

### Creating the parallel test users
Two options — run one of these once:

**Option A — SQL Editor (recommended):**
```sql
-- paste contents of supabase/create_test_users.sql into Supabase SQL Editor
```

**Option B — Python script:**
```bash
python supabase/create_test_users.py
```

### Deleting test users (cleanup)
```sql
DELETE FROM auth.users WHERE email LIKE 'testuser%@gmail.com';
```

### `.env.test` template
```
BASE_URL=https://<staging>.vercel.app
SUPABASE_TEST_URL=https://<test-project>.supabase.co
SUPABASE_TEST_ANON_KEY=<anon key>
SUPABASE_TEST_SERVICE_KEY=<service role key>

# Primary accounts
TEST_STUDENT_EMAIL=voletis17@gmail.com
TEST_STUDENT_PASSWORD=Krishnamargam
TEST_ADMIN_EMAIL=sridhar.voleti@gmail.com
TEST_ADMIN_PASSWORD=Krishnamargam

# Parallel test accounts (all password: KrishnaMargam)
TEST_USER1_EMAIL=testuser1@gmail.com
TEST_USER2_EMAIL=testuser2@gmail.com
TEST_USER3_EMAIL=testuser3@gmail.com
TEST_USER4_EMAIL=testuser4@gmail.com
TEST_USER5_EMAIL=testuser5@gmail.com   # admin role
TEST_PARALLEL_PASSWORD=KrishnaMargam
```

---

## SQL Scripts Created

| File | Purpose |
|------|---------|
| `supabase/promote_sridhar_admin.sql` | One-time: promotes sridhar.voleti@gmail.com to admin |
| `supabase/promote_test_admin.sql` | Generic: `SELECT promote_to_admin('email')` — run in SQL Editor |

To promote any user to admin:
```sql
UPDATE public.profiles SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'email@example.com');
```
To revoke admin:
```sql
UPDATE public.profiles SET is_admin = false
WHERE id = (SELECT id FROM auth.users WHERE email = 'email@example.com');
```
Note: the `promote_to_admin()` function in `20260526_promote_to_admin_fn.sql` was never applied to the DB — use direct UPDATE instead.

---

## Directory Layout

```
tests/
├── conftest.py                      # base_url fixture, loads .env.test
├── pytest.ini                       # markers, asyncio_mode=auto
├── requirements.txt                 # pytest, playwright, httpx, supabase, etc.
├── .env.test.example                # template (do not commit .env.test)
│
├── fixtures/
│   ├── users.py                     # test_student, test_admin (read from env, not created dynamically)
│   └── courses.py                   # test_path, test_course, test_lesson, test_draft_course, enrolled_student
│
├── utils/
│   ├── supabase_admin.py            # service-role Supabase client
│   └── auth.py                      # get_token(email, password) → JWT
│
├── e2e/
│   ├── conftest.py                  # browser, student_context, admin_context, student_page, admin_page, anon_page
│   ├── pages/                       # Page Object Models
│   │   ├── base_page.py
│   │   ├── login_page.py
│   │   ├── register_page.py
│   │   ├── home_page.py
│   │   ├── explore_page.py
│   │   ├── watch_page.py
│   │   ├── my_courses_page.py
│   │   ├── profile_page.py
│   │   └── admin/
│   │       ├── admin_login_page.py
│   │       ├── admin_dashboard_page.py
│   │       ├── admin_courses_page.py
│   │       ├── admin_lessons_page.py
│   │       ├── admin_students_page.py
│   │       └── admin_payments_page.py
│   └── auth/
│       ├── test_login.py
│       ├── test_logout.py
│       ├── test_session.py
│       ├── test_protected_routes.py
│       └── test_admin_auth.py
│
└── api/
    ├── conftest.py                  # httpx client, student_headers, admin_headers
    └── auth/
        ├── test_check_email.py
        ├── test_register.py
        └── test_otp.py
```

*(Remaining dirs for phases P2–P7 to be created during those phases)*

---

## Implementation Status

| Phase | Scope | Status | Files written |
|-------|-------|--------|---------------|
| **P0** | Infrastructure (pytest.ini, conftest, fixtures, utils, POMs) | ✅ Complete | All files written |
| **P1** | Authentication (30 TCs) | ✅ Complete | All files written |
| **P2** | Course Discovery (19 TCs) | 🔜 Not started | — |
| **P3** | Enrollment (17 TCs, 10 xfail) | 🔜 Not started | — |
| **P4** | Learning Experience (33 TCs) | 🔜 Not started | — |
| **P5** | Profile (7 TCs) | 🔜 Not started | — |
| **P6** | Admin (41 TCs) | 🔜 Not started | — |
| **P7** | Security / Edge Cases (5 TCs) | 🔜 Not started | — |

---

## Key Design Decisions

### Authentication Strategy
- **E2E sessions**: Authenticated via real UI login (`_login_context` helper in `e2e/conftest.py`). Session stored in browser context. Session-scoped so login happens once per test run.
- **API tests**: JWT token obtained via Supabase `/auth/v1/token` REST endpoint. Passed as `Authorization: Bearer <token>` header.
- **Test users**: NOT dynamically created. Uses real accounts from `.env.test`. The `fixtures/users.py` just fetches the token and user ID.
- **Admin distinction**: `sridhar.voleti@gmail.com` is admin, `voletis17@gmail.com` is student. These are separate accounts.

### Database Fixtures
- `test_path`, `test_course`, `test_lesson`, `test_draft_course` → **session-scoped** (created once, reused)
- `enrolled_student` → **function-scoped** (per-test enrollment + cleanup)
- Cleanup order: `user_progress` → `enrollments` → `lessons` → `courses` → `paths` (respects FK constraints)
- `enrollments.is_active` is a **boolean** (not a `status` text field — important for DB assertions)

### External Services (xfail)
- **Razorpay**: Not yet integrated. TC-ENROLL-API-05 to 11 and TC-ENROLL-E2E-04 to 06 are `xfail`.
- **Resend email**: Not asserted at delivery level; only HTTP 200 from send endpoint is tested.
- When Razorpay integration lands: remove `@pytest.mark.xfail` decorators from those tests.

### Session / Inactivity Behaviour
- Supabase access token TTL: **1 hour** (expires after 2h inactivity)
- Supabase refresh token TTL: **1 week** (still valid at 2h)
- Middleware calls `supabase.auth.getUser()` on every request → SSR library auto-refreshes using refresh token
- **After 2h inactivity**: Access token expired → SSR auto-refreshes silently → user stays logged in ✅
- **After session revocation** (admin signOut, or full expiry): `getUser()` returns null → redirect to `/login?returnTo=<path>` ✅
- Two session tests cover both scenarios: `test_expired_access_token_auto_refreshes` and `test_revoked_session_redirects_to_login`

---

## Source Code Corrections Discovered During Audit
(Used to fix test assertions before writing tests)

| Assumption | Actual (from source) |
|-----------|---------------------|
| `check-email` returns `{available: bool}` | Returns `{"exists": bool}` |
| `GET /api/courses` returns array | Returns `{items, total, limit, offset, hasMore}` |
| `GET /api/quiz/[courseId]` is public | Requires auth + active enrollment (401/403) |
| Register returns 409 for duplicate email | Returns 400 (Supabase error re-wrapped) |
| `enrollments.status` is a text field | `enrollments.is_active` is a boolean |
| Login always redirects to `/` | Admin → `/admin`; incomplete profile → `/onboarding`; else → `returnTo` |

---

## Running the Suite

```bash
# Install
pip install -r tests/requirements.txt
playwright install chromium

# Copy and fill
cp tests/.env.test.example tests/.env.test

# Full suite
pytest tests/ --html=report.html -v

# By layer
pytest tests/api/ -v
pytest tests/e2e/ -v --headed   # headed = visible browser (debug mode)

# By area
pytest tests/ -m "auth" -v
pytest tests/ -m "admin" -v

# Active tests only (exclude xfail)
pytest tests/ -m "not xfail" -v
```

---

## P1 Test Cases — Authentication (30 tests)

| ID | File | Description |
|----|------|-------------|
| TC-AUTH-E2E-01 | test_login.py | Valid login → redirected away from /login |
| TC-AUTH-E2E-02 | test_login.py | Wrong password → error box visible |
| TC-AUTH-E2E-03 | test_login.py | Unregistered email → error box visible |
| TC-AUTH-E2E-04 | test_login.py | Empty email → browser validation, no submit |
| TC-AUTH-E2E-05 | test_login.py | `?returnTo=/profile` → redirect to /profile after login |
| TC-AUTH-E2E-06 | test_login.py | Already authenticated → redirected away from /login |
| TC-AUTH-E2E-07 | test_logout.py | Logout → "Sign In" appears in navbar |
| TC-AUTH-E2E-07b | test_logout.py | After logout → /my-courses redirects to /login |
| TC-AUTH-SESSION-01 | test_session.py | Expired access token + valid refresh → auto-refresh, user stays logged in |
| TC-AUTH-SESSION-02 | test_session.py | Server-side session revoked → redirect to /login with returnTo |
| TC-AUTH-E2E-13 | test_protected_routes.py | /my-courses without session → /login?returnTo=/my-courses |
| TC-AUTH-E2E-14 | test_protected_routes.py | /profile without session → /login?returnTo=/profile |
| TC-AUTH-E2E-15 | test_protected_routes.py | /watch/[slug] without session → /login?returnTo=... |
| TC-AUTH-E2E-18 | test_admin_auth.py | Admin login → /admin dashboard |
| TC-AUTH-E2E-19 | test_admin_auth.py | Student creds at /admin/login → stays on /admin/login |
| TC-AUTH-E2E-20/21 | test_admin_auth.py | /admin, /admin/courses, /admin/students without session → /admin/login |
| TC-AUTH-API-01 | test_check_email.py | New email → `{"exists": false}` |
| TC-AUTH-API-02 | test_check_email.py | Existing email → `{"exists": true}` |
| TC-AUTH-API-03 | test_check_email.py | Missing email → 400 `{"error": "Email is required"}` |
| TC-AUTH-API-05 | test_register.py | Valid payload → 200 `{"success": true}` |
| TC-AUTH-API-06 | test_register.py | Empty body → 400 |
| TC-AUTH-API-07 | test_register.py | Missing email → 400 `{"error": "Email and password are required"}` |
| TC-AUTH-API-08 | test_register.py | Missing password → 400 `{"error": "Email and password are required"}` |
| TC-AUTH-API-09 | test_register.py | Duplicate email → 400 with error key |
| TC-AUTH-API-10 | test_otp.py | Wrong OTP → 400 with error key |
| TC-AUTH-API-11 | test_otp.py | send-reset known email → 200 |
| TC-AUTH-API-12 | test_otp.py | send-reset unknown email → 200 (no info leak) |
