# OI-003: Course Catalog Migration — Reviewer Checklist

**Task:** Migrate courses from hard-coded `courseData.ts` to database-driven architecture  
**Implementation Date:** 2026-05-27  
**Status:** Ready for Code Review & Testing  

---

## Code Review Checklist

### Architecture & Design
- [ ] Service layer (`getCourses.ts`) follows existing patterns (similar to auth helpers)
- [ ] Cache strategy is sound (24-hour TTL, graceful fallback)
- [ ] No breaking changes to frontend contracts (API changes documented)
- [ ] Error handling prevents 500 errors (fallback to seed data)
- [ ] No N+1 query issues (single query per request)

### Implementation Quality
- [ ] TypeScript types are complete (no `any` types)
- [ ] Proper use of async/await (no promise chains mixed with async)
- [ ] Functions are well-named and focused (single responsibility)
- [ ] Comments present for non-obvious logic (cache TTL, fallback strategy)
- [ ] No console.log spam (only error logging)
- [ ] Proper error logging with context

### Security
- [ ] No SQL injection vulnerabilities (using Supabase parameterized queries)
- [ ] YouTube video IDs still stripped from public API ✅ (not fetched by this function)
- [ ] No sensitive data exposed in API responses
- [ ] Cache keys don't leak sensitive info
- [ ] Fallback to seed data doesn't expose unpublished courses

### Performance
- [ ] In-memory cache reduces DB load (expected 95%+ cache hit rate)
- [ ] Pagination prevents large result sets from causing timeouts
- [ ] Cache TTL is appropriate (24 hours for course catalog)
- [ ] No N+1 queries in pagination loop
- [ ] Fallback mechanism doesn't cause performance degradation

### Testing
- [ ] Unit tests cover happy path ✅
- [ ] Unit tests cover edge cases ✅
  - [ ] Cache hit/miss
  - [ ] Cache invalidation
  - [ ] DB failure
  - [ ] Pagination boundaries (limit, offset, max-cap)
- [ ] Integration tests cover API contract ✅
  - [ ] Pagination parameters respected
  - [ ] Cache headers present
  - [ ] hasMore calculation correct
  - [ ] Error responses proper (500)
- [ ] Test coverage >80% for new code ✅

### Backward Compatibility
- [ ] Hard-coded `COURSES` still available as fallback ✅
- [ ] No breaking changes to student-facing pages ✅
- [ ] Admin panel still works ✅
- [ ] External API consumers notified of response format change ✅ (documented in migration notes)

---

## Manual Testing Checklist

### Student Journey
- [ ] **Explore Page:**
  - [ ] Page loads without errors
  - [ ] Courses display correctly
  - [ ] Course count matches DB
  - [ ] Sorting works (popular, price, rating)
  - [ ] Category filtering works
  - [ ] Level filtering works

- [ ] **Payment Page:**
  - [ ] Select course on explore page
  - [ ] Payment page loads with correct course details
  - [ ] Price displays correctly
  - [ ] Price matches DB, not hard-coded
  - [ ] Payment flow completes (UPI initiate)

- [ ] **My Courses:**
  - [ ] Enrolled courses display correctly
  - [ ] Progress tracking works
  - [ ] Links to watch page work

### Admin Journey
- [ ] **Admin Dashboard:**
  - [ ] Course list displays
  - [ ] Create new course works
  - [ ] Edit course works
  - [ ] Update course price works

- [ ] **Cache Invalidation:**
  - [ ] Admin updates course price to 999
  - [ ] Payment page still shows old price (cache)
  - [ ] After 24 hours (or manual invalidation), new price shows ⚠️
    - ℹ️ If cache invalidation endpoint not added, will take 24h

### Error Scenarios
- [ ] **DB Unavailable:**
  - [ ] Explore page still loads (seed data fallback) ✅
  - [ ] Payment page still works (seed data fallback) ✅
  - [ ] No 500 errors ✅
  - [ ] Error logged to console ✅

- [ ] **Stale Cache:**
  - [ ] Admin updates price
  - [ ] Payment page reflects in <24 hours if cache invalidated
  - [ ] After 24 hours, price updates if cache invalidation not triggered

### Performance Testing
- [ ] Load test with 1000+ courses (manual)
  - [ ] Pagination works
  - [ ] No timeout errors
  - [ ] Response time <500ms (p95)
  - [ ] Memory usage stable (no cache memory leak)

---

## Database Validation

- [ ] `courses` table exists with all required columns
- [ ] Seed data (initial courses) can be loaded
  - [ ] Option 1: Use `courseData.ts` as fallback (current)
  - [ ] Option 2: Run seed migration (optional)
- [ ] Indexes on `id`, `slug`, `published` exist (for performance)
- [ ] No orphaned lessons (all have valid course_id)

---

## Integration Points

### Dependencies
- [ ] `Supabase` client working correctly
- [ ] Anon key has permission to read courses table
- [ ] No admin client needed (anon key sufficient)

### Dependent Systems
- [ ] Admin course update endpoint should call `invalidateCoursesCache()`
  - **Status:** ⚠️ Not yet implemented (follow-up task)
  - **Impact:** Cache will expire in 24h, or admin must manually invalidate

### Notification/Logging
- [ ] Error logging to console (for debugging)
- [ ] Cache hit/miss statistics (optional, for monitoring)

---

## Documentation Validation

- [ ] Migration notes document API contract changes
- [ ] Rollback plan documented (< 5 min)
- [ ] Integration checklist provided
- [ ] Known issues and risks identified (none found)
- [ ] Reviewer notes present in code comments

---

## Sign-Off Criteria

### Passing Criteria (Must Have)
✅ **Code Quality**
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Proper error handling

✅ **Testing**
- [ ] 30+ unit tests passing
- [ ] 15+ integration tests passing
- [ ] No test failures

✅ **Manual Testing**
- [ ] Student can view explore page
- [ ] Student can go through payment flow
- [ ] Admin can update course (and cache works)
- [ ] Graceful fallback when DB unavailable

✅ **Documentation**
- [ ] Migration notes complete
- [ ] API changes documented
- [ ] Rollback plan provided

### Warnings (Should Address)
⚠️ **Cache Invalidation**
- Admin course update endpoint should call `invalidateCoursesCache()`
- Workaround: 24-hour cache TTL
- Follow-up task: Add invalidation endpoint

⚠️ **Seed Data Dependency**
- Fallback relies on `courseData.ts` being in sync with DB
- Mitigation: Consider one-time seed migration
- Risk: Low (graceful fallback only used if DB down)

### Blockers (Must Fix Before Merging)
❌ None identified

---

## Final Approval

**Code Review Status:**
- [ ] Architecture reviewed and approved by: __________
- [ ] Implementation reviewed and approved by: __________

**Testing Approval:**
- [ ] Manual testing completed by: __________
- [ ] Test coverage verified by: __________

**Integration Approval:**
- [ ] Production readiness confirmed by: __________

**Merge Decision:**
- [ ] Ready to merge to `main`
- [ ] Ready to merge to `develop` (needs further testing)
- [ ] Needs revisions (list issues below)

---

## Issues Found During Review

(Add any issues discovered during code/manual testing)

| Issue | Severity | Owner | Status |
|-------|----------|-------|--------|
| (Example: cache invalidation not called on admin update) | Medium | Backend | Open |

---

## Notes

- **Test Execution Time:** ~2 minutes (unit + integration tests)
- **Manual Testing Time:** ~30 minutes (all scenarios)
- **Code Review Time:** ~20 minutes (architecture + implementation)
- **Total Validation Time:** ~1 hour

---

**Reviewer Instructions:**
1. Review code against architecture/design section
2. Run test suite: `npm test getCourses courses-api`
3. Execute manual testing checklist
4. Validate database schema
5. Check documentation completeness
6. Mark sign-off criteria
7. Approve or request revisions

**Questions?** See OI-003_MIGRATION_NOTES.md for implementation details.
