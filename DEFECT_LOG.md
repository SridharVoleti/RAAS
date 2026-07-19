# Defect Log — Krishnamargam (RAAS)

All reported defects, root causes, and resolutions. Every new issue raised goes here.
Format: newest defects at the top within each section.

---

## How to Use This Log

| Field | Meaning |
|---|---|
| **ID** | Sequential, prefixed by module (e.g. `AUTH-001`) |
| **Severity** | P1 = blocker, P2 = major, P3 = minor/cosmetic |
| **Status** | Open / Fixed / Won't Fix |
| **Commit** | Git commit hash where the fix landed |

---

## EXAM — Final Test & Prior Learning

---

### EXAM-001 · Guru-declared student saw no link to the final exam; enrollment couldn't self-heal after `has_exam` was turned on late
| | |
|---|---|
| **Date** | 2026-07-19 |
| **Severity** | P1 |
| **Status** | Fixed |
| **Commit** | _(pending commit)_ |

**Issue**
A student registered a prior-learning (external guru) declaration for a RAAS course but saw no link to the 100-question final exam anywhere — neither in the `PriorLearningDialog` post-submit view nor on the student home page.

**Root Cause**
Every RAAS course had `courses.has_exam = false` in the database, including the one the student declared (which already had 197 exam questions loaded — an admin had loaded the question bank but never flipped the "Has Certification Exam" toggle in `CourseForm`). Both the dialog and the exam link on the student home page correctly gate on `has_exam`, so nothing showed.
Separately, `POST /api/prior-learning` only creates the `exam_only` enrollment row as a one-time snapshot at declaration time, gated on `has_exam` being true *at that moment*. Since the declaration checkbox is permanently disabled once submitted, there was no client path to retroactively create the enrollment even after an admin later turned `has_exam` on — any student who declared before the course was fully configured would be stuck forever with a declaration but no exam access.

**Solution**
- Set `has_exam = true` on the affected course (data fix).
- Added `ensureExamOnlyEnrollment()` (`src/lib/exam.ts`) and wired it into `GET /api/exam/[courseId]/session` and `POST /api/exam/[courseId]/start`: if a student has no active enrollment but does have a `prior_learning_declarations` row and the course now has `has_exam = true`, the enrollment is created on the fly the next time they load or start the exam. No manual backfill needed for future occurrences of this gap.

**Prevention for Future Projects**
- Whenever a "feature flag" column (like `has_exam`) gates access that was already granted through a separate declaration/registration flow, don't assume the flag and the grant happen in the same transaction — write the downstream check to self-heal (create the missing grant on read) rather than only creating it once at declaration time.
- Admin forms that have two independent manual steps to fully enable a feature (here: toggle `has_exam` + separately upload `exam_questions`) should cross-validate or at least warn when one is set without the other.

---

## UI — Admin Content Widgets

---

### UI-002 · Widget selection outline (gold border) saved into HTML and rendered on home page
| | |
|---|---|
| **Date** | 2026-06-12 |
| **Severity** | P2 |
| **Status** | Fixed |
| **Commit** | 0f9b11d |

**Issue**
After inserting and repositioning an image in the widget rich text editor, the gold selection outline (`outline: 2px solid #f0b429`) was visible on published widgets on the home page.

**Root Cause**
`applyImgFloat` embedded `outline` directly in the image's `cssText` string, and `handleEditorClick` set `img.style.outline` directly on the DOM element. Both were captured in `innerHTML` when `handleSave` called `editorRef.current.innerHTML`, so the outline was persisted to the database.

**Solution**
Strip `outline` from `applyImgFloat`'s cssText; re-apply it as a separate `img.style.outline` assignment (not in cssText). In `handleSave`, query all images and set `img.style.outline = ''` before reading `innerHTML`.

**Prevention**
Editor-only visual indicators (focus rings, selection outlines, placeholder text) must never be part of the serialised `innerHTML`. Strip or use non-serialised CSS (e.g. `:focus` pseudo-class) for anything that shouldn't reach the DB.

---

### UI-001 · Widget Save button disabled when content contains only images (no text)
| | |
|---|---|
| **Date** | 2026-06-12 |
| **Severity** | P2 |
| **Status** | Fixed |
| **Commit** | 0f9b11d |

**Issue**
After inserting one or more images into the widget editor, the Save button remained disabled even with a valid title.

**Root Cause**
`hasText(html)` stripped all HTML tags with a regex and checked if any text remained. `<img>` elements have no text content, so image-only widgets always evaluated to empty and the guard `!hasText(html)` kept the button in a disabled state.

**Solution**
Renamed to `hasContent(html)`. Returns true if visible text is present OR if the HTML contains at least one `<img` tag.

**Prevention**
"Content present" checks for rich text must account for non-text media. Validate against the media type set the editor supports.

---

## EMAIL — Newsletter & Transactional Email

---

### EMAIL-002 · Newsletter stuck as "Sent" indefinitely — never delivered to Gmail
| | |
|---|---|
| **Date** | 2026-06-12 |
| **Severity** | P1 |
| **Status** | Fixed |
| **Commit** | a7626c7 |

**Issue**
Newsletter showed "Sent" status in Resend dashboard for 30+ minutes with no delivery update. Recipients (all Gmail) never received the email. `from:srikrishnamargam.in in:anywhere` in Gmail returned zero results — Gmail never received the message.

**Root Cause**
Sending one email with 8 Gmail addresses in the `bcc` field caused Resend's outbound infrastructure to stall the delivery queue. BCC bulk sending to multiple Gmail addresses from a shared Resend IP is treated as a spam pattern; Gmail's MTAs rate-limit or temporarily refuse the connection, and Resend queued without surfacing a "delivery delayed" status. SPF and DKIM were verified, so the issue was the BCC pattern itself, not domain authentication.

**Solution**
Replaced single BCC email with `resend.batch.send()` — one individual email per recipient, sent in one API call per batch of 50. Each email has a clean single `to:` field. Resend treats these as normal transactional traffic.

**Prevention**
BCC is a spam signal for email infrastructure. For bulk delivery always use individual `to:` per recipient, even if it means more API calls. Use a batch endpoint (`resend.batch.send`) for efficiency.

---

### EMAIL-001 · Newsletter shows 0 registered users despite enrolled students
| | |
|---|---|
| **Date** | 2026-06-10 |
| **Severity** | P2 |
| **Status** | Fixed |
| **Commit** | 4ea11f3 |

**Issue**
Newsletter composer showed "0 registered members will receive this" even with 3–5 enrolled students.

**Root Cause**
`getAllUserEmails` used `if (error || !data?.users?.length) break` — any error from `auth.admin.listUsers` silently broke the loop and returned `[]`. The error was never logged.

**Solution**
Log the actual error; add a two-tier fallback: primary = `listUsers`, fallback = `profiles` table → `getUserById` in parallel chunks of 10. Surface `fetchError` in GET response; show diagnostic in the UI.

**Prevention**
Never silently break on Supabase errors for critical data fetches. Always log the error object (not just a boolean) and provide a fallback or surface the error to the caller.

---

## QUIZ — Lesson Quizzes

---

### QUIZ-001 · Previously added quiz question invisible — live DB still on course-level schema, per-lesson queries failed silently
| | |
|---|---|
| **Date** | 2026-06-11 |
| **Severity** | P2 |
| **Status** | Fixed |
| **Commit** | 7e939d7 |

**Issue**
A quiz question added earlier by the admin did not appear in the student watch page (no "Test your knowledge" entry in the Lessons panel) even though the row existed in `quiz_questions`.

**Root Cause**
Two parallel quiz implementations wrote to the same tables with different keys. The live Supabase `quiz_questions` and `quiz_submissions` tables were created by the older course-level feature and only have a `course_id` column. The newer per-lesson code (watch page, `/api/admin/lessons/[id]/quiz`, submit route) queries `lesson_id`, which does not exist in the live DB — Postgres returns error 42703, Supabase returns `data: null`, and the code coalesced it to `[]`, hiding the failure. The repo migration `supabase/migrations/quiz_tables.sql` was never applied: its `create table if not exists` silently no-op'd because the old tables already existed, so the `lesson_id` columns were never created. The existing question (id 1) was stored with `course_id = 3` and `lesson_id` missing.

**Solution**
- New idempotent migration `supabase/migrations/20260611_quiz_lesson_id.sql`: adds `lesson_id` to both tables, backfills existing course-level rows to the first lesson of their course, drops `NOT NULL` on legacy `course_id`, adds indexes. Must be run manually in the Supabase SQL Editor.
- Deleted the dead course-level routes (`/api/quiz/[courseId]`, `/api/quiz/[courseId]/submit`, `/api/admin/courses/[id]/quiz`) so nothing can write course-keyed quiz rows again.
- Admins can now move a question to a different lesson via a Lesson dropdown in the admin quiz panel (`lesson_id` added to `UpdateQuizQuestionSchema` and the PUT `/api/admin/quiz/[id]` route), so the backfilled placement can be corrected per requirement.

**Prevention for Future Projects**
- `create table if not exists` is not a schema sync — it silently skips when a table with the same name exists in any shape. Verify applied schema against the live DB (e.g. probe expected columns) after running migrations.
- Don't keep two API surfaces writing the same table with different foreign keys; delete the old surface when re-keying a feature.
- Don't blindly coalesce Supabase `data: null` to `[]` for required data — check `error` and log/surface it, otherwise schema drift hides as "no rows".

---

## AUTH — Authentication & Password Reset

---

### AUTH-008 · Post-login `router.push()` served stale router-cached page, looping back to /login
| | |
|---|---|
| **Date** | 2026-06-03 |
| **Severity** | P1 |
| **Status** | Fixed |
| **Commit** | — |

**Issue**
After a session expired and the user re-authenticated on `/login`, they were silently looped back to `/login` instead of reaching the intended destination. No error was shown; the form appeared to succeed but navigation went nowhere.

**Root Cause**
After `signInWithPassword()` succeeded, the code called `router.push(returnTo)` immediately followed by `router.refresh()`. Next.js App Router has an in-memory router cache. If `returnTo` (e.g. `/my-courses`) had been visited before while unauthenticated, the router cache held a stale fetch result for that route. `router.push()` fired first and hit the cache, serving the unauthenticated page load — which the middleware then redirected back to `/login`. `router.refresh()` ran too late to prevent this.

**Solution**
Replaced all three post-login navigation calls (`router.push() + router.refresh()`) with `window.location.href = destination`. A full browser navigation bypasses the Next.js router cache entirely, sends a fresh HTTP request with the newly set session cookies, and lets the middleware validate the session correctly.

**Prevention for Future Projects**
- Never use `router.push()` + `router.refresh()` for post-authentication redirects in Next.js App Router. The cache hit can race the refresh.
- Always use `window.location.href = destination` (or `window.location.replace()` to avoid a back-button loop) after any action that changes auth state.
- This applies to login, logout, and any step-up auth (e.g. MFA prompts).

---

### AUTH-007 · Middleware discarded Supabase cookie-clears on redirect, leaving stale expired tokens in browser
| | |
|---|---|
| **Date** | 2026-06-03 |
| **Severity** | P1 |
| **Status** | Fixed |
| **Commit** | — |

**Issue**
When a user's session expired and they navigated to a protected route, the middleware correctly redirected them to `/login`. However, the browser retained the expired Supabase session cookies. On the login page, `signInWithPassword()` appeared to succeed but subsequent requests were still sent with the stale tokens, causing auth failures that only cleared after the user manually cleared browser storage.

**Root Cause**
In `middleware.ts`, when `supabase.auth.getUser()` detects a non-refreshable expired token, the Supabase SDK internally calls the `setAll` cookie handler to write empty/deleted `Set-Cookie` headers onto `supabaseResponse`. The middleware then returned `NextResponse.redirect(url)` — a brand-new response object that had none of those `Set-Cookie` headers. The cookie-clearing instructions were silently dropped. The browser never received the instruction to delete the stale tokens.

**Solution**
Before returning any redirect response, copy all cookies from `supabaseResponse` onto the redirect response:
```typescript
const redirectResponse = NextResponse.redirect(url)
supabaseResponse.cookies.getAll().forEach(cookie => {
  redirectResponse.cookies.set(cookie.name, cookie.value, cookie as ...)
})
return redirectResponse
```
Applied to both the protected-route redirect (`/login`) and the admin redirect (`/admin/login`).

**Prevention for Future Projects**
- In any Next.js + Supabase SSR setup, a redirect response is a new `NextResponse` object and does **not** inherit cookies from `supabaseResponse` automatically.
- Whenever the middleware returns `NextResponse.redirect()` instead of `supabaseResponse`, always copy `supabaseResponse.cookies` to the redirect before returning.
- Write a middleware integration test that checks `Set-Cookie` headers on the redirect response after a forced token expiry.

---

### AUTH-006 · Sending domain not verified in Resend
| | |
|---|---|
| **Date** | 2026-05-29 |
| **Severity** | P1 |
| **Status** | Fixed (interim) |
| **Commit** | `bd76132` |

**Issue**
`resetPasswordForEmail` and the custom `/api/auth/send-reset` route both failed with a 403 from Resend: *"The srikrishnamargam.in domain is not verified."*

**Root Cause**
The `RESEND_FROM_EMAIL` env var was set to `noreply@srikrishnamargam.in` but that domain had not been registered or verified in the Resend dashboard. Resend requires SPF/DKIM/DMARC DNS records on the sending domain before any emails are dispatched.

**Solution (interim)**
Set `RESEND_FROM_EMAIL=onboarding@resend.dev` in Vercel env vars. Resend's shared test sender requires no domain ownership and works immediately.

**Permanent Fix**
1. Register `srikrishnamargam.in` with a domain registrar (Vercel Domains recommended for tight DNS integration).
2. In Resend → Domains, add the domain and copy the 3 DNS records (SPF, DKIM, DMARC).
3. Add those records in the registrar's DNS panel.
4. Click Verify in Resend — usually propagates within 5 minutes on Vercel DNS.
5. Update `RESEND_FROM_EMAIL=noreply@srikrishnamargam.in` in Vercel env vars.

**Prevention for Future Projects**
- Before going live, always verify the sending domain in Resend and send a test email from the Resend dashboard.
- Add domain verification as a pre-launch checklist item.
- Keep `RESEND_FROM_EMAIL` as an env var (never hardcode) so the sender can be swapped without a redeploy.

---

### AUTH-005 · Supabase SMTP relay failing for auth emails
| | |
|---|---|
| **Date** | 2026-05-29 |
| **Severity** | P1 |
| **Status** | Fixed |
| **Commit** | `bd76132` |

**Issue**
After enabling Custom SMTP in Supabase with Resend credentials, `supabase.auth.resetPasswordForEmail()` returned *"Failed to send email"*. Setting up SMTP with correct credentials (host: `smtp.resend.com`, port: 465, username: `resend`, password: API key) still failed.

**Root Cause**
Supabase's custom SMTP relay adds an extra network hop (Supabase servers → customer's SMTP config → Resend). TLS handshake failures, port mismatches, and Supabase's own delivery retries all create a fragile path that is hard to debug.

**Solution**
Bypassed Supabase's email sending entirely. New flow in `/api/auth/send-reset`:
1. `supabase.auth.admin.generateLink({ type: 'recovery', email })` — generates the signed token without sending anything.
2. `resend.emails.send()` — delivers the branded email directly via Resend's API, the same path already used for enrollment emails.

**Prevention for Future Projects**
- Never rely on Supabase's built-in email delivery for critical transactional flows (password reset, magic links).
- Use `admin.generateLink()` + your own email SDK for all auth emails from the start.
- This gives full control over email templates, delivery, logging, and retries.

---

### AUTH-004 · No resend cooldown — Supabase rate limit exhausted after 3 attempts
| | |
|---|---|
| **Date** | 2026-05-29 |
| **Severity** | P2 |
| **Status** | Fixed |
| **Commit** | `d4ca833` |

**Issue**
The "Resend link" button on the forgot-password confirmation screen had no throttle. Clicking it multiple times rapidly exhausted Supabase's default auth email rate limit (3–4 emails/hour per address), blocking all further reset attempts.

**Root Cause**
The resend button called the same `handleReset` function with no cooldown state. No server-side rate limiting either.

**Solution**
Added a 60-second client-side cooldown after each send. The button shows a live countdown (`Resend in 42s`) and is disabled during the cooldown. Implemented via `useRef<setInterval>` + `useState<number>` countdown.

**Prevention for Future Projects**
- Any "resend" or "retry" button on an email/SMS action must have a client-side cooldown (≥60 seconds).
- Consider server-side rate limiting (e.g. per-IP or per-email with Redis TTL) for production hardening.

---

### AUTH-003 · Forgot-password accepts any email — no account existence check
| | |
|---|---|
| **Date** | 2026-05-29 |
| **Severity** | P2 |
| **Status** | Fixed |
| **Commit** | `d4ca833` |

**Issue**
Anyone could enter any email address and trigger a password reset email dispatch — burning through the email quota and potentially being used for spam/harassment.

**Root Cause**
`supabase.auth.resetPasswordForEmail()` was called directly on form submit with no prior validation of whether the email belongs to a registered account. Supabase intentionally returns success for non-existent emails (to prevent user enumeration), so the UI never showed an error.

**Solution**
Created `/api/auth/check-email` (later merged into `/api/auth/send-reset`): uses `supabase.auth.admin.listUsers()` server-side (service role key, never exposed to browser) to confirm the email exists before dispatching. Returns 404 with `{ exists: false }` for unknown emails; the UI shows *"No account found with this email address."*

**Prevention for Future Projects**
- Always gate password reset dispatch behind a server-side account existence check using the admin client.
- Keep the check server-side only — never expose user existence logic to the browser.

---

### AUTH-002 · Forgot-password accepts invalid email formats
| | |
|---|---|
| **Date** | 2026-05-29 |
| **Severity** | P3 |
| **Status** | Fixed |
| **Commit** | `d4ca833` |

**Issue**
The forgot-password form relied solely on the browser's `type="email"` validation, which is easily bypassed and inconsistently implemented across browsers.

**Root Cause**
No explicit client-side regex validation before submitting.

**Solution**
Added `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` check in `handleReset` before any network call. Invalid formats are rejected immediately with a visible error.

**Prevention for Future Projects**
- Always add an explicit email regex check in the submit handler, independent of HTML5 `type="email"`.

---

### AUTH-001 · Password reset page had no strength validation and button got stuck
| | |
|---|---|
| **Date** | 2026-05-29 |
| **Severity** | P1 |
| **Status** | Fixed |
| **Commit** | `d4ca833` |

**Issue**
Two problems on `/auth/reset-password`:
1. Only checked minimum 8 characters — no uppercase, number, or special character requirement.
2. Clicking "Update Password" left the button permanently stuck on *"Updating…"* — the password never changed.

**Root Cause — Weak validation**
The only guard was `if (password.length < 8)`. The `minLength={8}` HTML attribute was also the sole input-level check.

**Root Cause — Stuck button**
Two issues compounded:
- `supabase.auth.updateUser()` was not wrapped in `try/catch/finally`. Any thrown exception (network error, expired token) skipped `setLoading(false)` entirely.
- The `onAuthStateChange` listener was a no-op. The `PASSWORD_RECOVERY` event (fired when Supabase exchanges the URL hash token for a session) was never captured, so `updateUser` could be called before a valid session existed — causing a silent failure.

**Solution**
- Added four validation rules (length ≥ 8, uppercase, number, special character) enforced on submit, with a live requirements checklist rendered as the user types (green ✓ / grey ○).
- Wrapped `updateUser` in `try/catch/finally` — `setLoading(false)` now always runs.
- Added `sessionReady` state flag set on `PASSWORD_RECOVERY` event; submitting before session is ready shows *"Reset link is invalid or has expired."*
- Redirect on success changed from `/my-courses` to `/login`.

**Prevention for Future Projects**
- Password fields must always enforce: min 8 chars + uppercase + number + special character. Add a live checklist for UX.
- Any `async` state-mutating function must use `try/catch/finally` so loading states are always cleared.
- Supabase password reset pages must listen for `PASSWORD_RECOVERY` before allowing `updateUser`.
- Post-reset redirect should go to the login page, not an authenticated page.

---

## BUILD — Build & Compilation

---

### BUILD-001 · TypeScript build failure from legacy `Old/` directory
| | |
|---|---|
| **Date** | 2026-05-29 |
| **Severity** | P2 |
| **Status** | Fixed |
| **Commit** | `40450ee` |

**Issue**
`npm run build` failed with a TypeScript error inside `Old/frontend/src/lib/auth.tsx` — an unrelated legacy codebase sitting in the repo root.

**Root Cause**
`tsconfig.json` excluded `node_modules`, `frontend`, and `backend` but not `Old/`. The TypeScript compiler picked up all `.ts/.tsx` files recursively including the legacy directory.

**Solution**
Added `"Old"` to the `exclude` array in `tsconfig.json`.

**Prevention for Future Projects**
- When keeping legacy/archived code in the repo, always add its directory to `tsconfig.json` `exclude` and `.eslintignore` immediately.
- Prefer moving legacy code outside the repo entirely, or into a branch, rather than keeping it in a subdirectory.
