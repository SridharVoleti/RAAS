# QUICK REFERENCE — SDLC Orchestration

**Last Updated:** 2026-05-27  
**Status:** v0.4.0 ready for v0.5.0 sprint

## CRITICAL PATH (5–7 days to launch)

```
Day 1:  OI-004 (Razorpay keys) + OI-005 (Resend keys)
        OI-002 (Request validation) + OI-008 (Logging)

Day 2:  OI-001 (Razorpay webhook)
        OI-006 (Mobile verify) + OI-009 (Fix IDOR)

Day 3:  OI-003 (DB-driven courses)
        OI-007 (API pagination)

Day 4:  OI-013 (Test suite - partial)

Day 5:  Documentation + QA
```

## OPEN ITEMS BY OWNER

### Claude (Backend, 18 hours)
- OI-001: Razorpay webhook (4h)
- OI-002: Request validation (4h)
- OI-003: DB-driven courses (4h)
- OI-006: Mobile verification (3h)
- OI-007: API pagination (4h)
- OI-009: Fix IDOR (2h)
- OI-011: CSRF protection (2h)
- OI-012: Certificate generation (8h)
- OI-014: Caching strategy (4h)

### Qwen (Config/DevOps/QA, 12 hours)
- OI-004: Razorpay keys (1h)
- OI-005: Resend keys (1h)
- OI-008: Logging setup (4h)
- OI-010: Profile page (3h)
- OI-013: Test suite (10h)
- OI-016: Dark mode (1h)

## DEPENDENCY CHAIN

```
[OI-004] ─┐
[OI-005] ─┼─→ [OI-001: Webhook] → LAUNCH
[OI-002] ─┤
[OI-003] ─┘

[OI-006] ─→ Registration flow (parallel)
[OI-008] ─→ Monitoring (parallel)
[OI-009] ─→ Payment security (parallel)
```

## BLOCKERS & ESCALATIONS

| Issue | Owner | Escalation |
|---|---|---|
| Razorpay signature invalid | Claude | Razorpay support |
| Webhook idempotency fails | Claude | Database locking review |
| Resend quota exceeded | Qwen | Resend support |
| Test setup complexity | Qwen | Claude if mocking issues |

## SUCCESS CRITERIA FOR v0.5.0

- ✅ Razorpay webhook auto-confirms payments
- ✅ Request validation on all endpoints
- ✅ Courses fully database-driven
- ✅ Payment IDOR vulnerability fixed
- ✅ Mobile verification complete
- ✅ Logs capture all payment operations
- ✅ 70%+ test coverage
- ✅ Admin playbook documented

## RISK MITIGATIONS

| Risk | Mitigation |
|---|---|
| API key invalid | Test immediately in sandbox (OI-004, OI-005) |
| Webhook signature fails | Use Razorpay sandbox + mock payloads |
| Email quota exceeded | Monitor sending rate, set limits |
| DB migration breaks | Dry-run in staging before production |
| Session timeout during payment | Add session refresh to payment UI |

## POST-LAUNCH BACKLOG (v0.6.0+)

1. OI-010: User profile page
2. OI-011: CSRF protection
3. OI-012: Certificate generation
4. OI-013: Comprehensive tests
5. OI-014: Caching strategy
6. OI-015: Multi-admin support
7. OI-016: Dark mode toggle
8. OI-017: Notifications system
9. OI-018: Analytics dashboard
10. OI-019: Referral system

---

**Need details?** See `.ai/planning/open_items.md`
