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

## AUTH — Authentication & Password Reset

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
