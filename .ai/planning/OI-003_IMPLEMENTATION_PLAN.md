# OI-003: Course Catalog Migration — Implementation Plan

**Task:** Migrate course catalog from hard-coded `courseData.ts` to database-driven architecture

**Status:** Ready for Implementation  
**Priority:** P0 (Critical Path)  
**Estimated Effort:** 3-4 hours  
**Routed To:** qwen2.5-coder (implementation), escalate to Claude if architecture ambiguity  

---

## 1. ANALYSIS & ROUTING DECISION

### Current State (Hard-Coded)
- **Location:** `src/lib/courseData.ts` (array of 20+ courses)
- **Consumer Patterns:**
  - `/explore` page: imports `COURSES` array
  - `/payment/[courseId]`: looks up course by ID in hard-coded array
  - `/api/courses`: queries database (good ✅)
  - Admin dashboard: queries database (good ✅)
- **Problem:** Payment page & explore page use stale hard-coded data

### Target State (DB-Driven)
- **Location:** PostgreSQL `courses` table (already exists in schema)
- **Consumer Patterns:**
  - All pages query via new `getCourses()` utility with caching
  - `/api/courses` uses pagination + caching
  - Payment page fetches course details on-demand
  - Fallback: Stale cache if DB unavailable (graceful degradation)

### Why This Isn't Escalating to Claude
- ✅ Architecture already clear (DB exists, just refactoring layers)
- ✅ No multi-module redesign needed
- ✅ Straightforward CRUD refactoring
- ✅ Existing patterns to follow (API routes already do this)
- → **Proceed with implementation**

---

## 2. AFFECTED FILES & MODULES

### Files to Create/Modify
```
src/
├── lib/
│   ├── getCourses.ts              [NEW] Service/repository layer
│   ├── courseData.ts              [KEEP] Only as seed data
│   └── utils.ts                   [MODIFY] Add caching helper
├── app/
│   ├── api/
│   │   └── courses/route.ts       [MODIFY] Add pagination + cache headers
│   ├── explore/page.tsx           [MODIFY] Use getCourses() instead of COURSES
│   └── payment/[courseId]/
│       └── page.tsx               [MODIFY] Use getCourses() for price lookup

tests/
├── unit/
│   └── getCourses.test.ts         [NEW] Unit tests
└── integration/
    └── courses.test.ts            [NEW] Integration tests
```

### Database Schema
- **Table:** `courses` (already exists in schema.sql)
- **Columns:** id, path_id, slug, title_en, title_te, price, etc.
- **Status:** ✅ Ready to use (no migration needed)

---

## 3. IMPLEMENTATION LAYERS

### Layer 1: Service/Repository (`src/lib/getCourses.ts`)
**Purpose:** Single source of truth for course data fetching

**Functions:**
```typescript
export async function getCourses(options?: {
  limit?: number
  offset?: number
  pathId?: number
  published?: boolean
}): Promise<Course[]>

export async function getCourseBySlug(slug: string): Promise<Course | null>

export async function getCourseById(id: number): Promise<Course | null>

export function getCoursesCacheKey(options?: object): string
export function invalidateCoursesCache(): void
```

**Implementation Notes:**
- Use Supabase client (anon key)
- Add in-memory cache with 24h TTL
- Fallback to courseData.ts if DB fails
- Error handling: log but don't throw (graceful degradation)

### Layer 2: API Route (`src/app/api/courses/route.ts`)
**Current:** Already queries DB  
**Updates:**
- Add pagination query params: `limit` (default 50, max 100), `offset`
- Add cache headers: `Cache-Control: public, max-age=86400` (24h)
- Response format: `{ items: Course[], total: number, nextOffset?: number }`

### Layer 3: Pages
**`/explore/page.tsx`:**
- Remove: `import { COURSES } from '@/lib/courseData'`
- Add: `const courses = await getCourses()`
- Update component calls to use dynamic data

**`/payment/[courseId]/page.tsx`:**
- Remove: `const found = COURSES.find(c => c.id === ...)`
- Add: `const course = await getCourseBySlug(slug)` or by ID
- Update price display to use dynamic value

### Layer 4: Caching Strategy
**In-Memory Cache:**
- Library: `node-cache` (lightweight)
- Key: Hash of query params
- TTL: 24 hours
- Invalidation: Manual (after admin updates)

**HTTP Cache Headers:**
- Public API: `Cache-Control: public, max-age=86400`
- Ensures CDN (Vercel) caches for 24h

**Graceful Fallback:**
- If Supabase fails: return cached data
- If no cache: return seed data from `courseData.ts`
- Log error but don't break the page

---

## 4. TESTING STRATEGY

### Unit Tests
- getCourses() returns array
- getCourseBySlug() finds correct course
- Cache hit returns same reference
- Cache TTL expires properly
- Fallback works if DB unavailable
- Error logging on failure

### Integration Tests
- GET /api/courses returns paginated list
- Cache-Control headers present
- Admin price update reflected in response
- Cursor pagination works

### E2E Tests
- Admin updates price → payment page shows new price
- Student can still complete payment flow

---

## 5. MIGRATION PLAN

**Phase 1 (30 min):** Create getCourses.ts + unit tests  
**Phase 2 (20 min):** Update /api/courses with pagination + integration tests  
**Phase 3 (40 min):** Update pages + E2E tests  
**Phase 4 (10 min):** Cleanup & documentation  

**Total:** 2-2.5 hours (plus testing)

---

## 6. ACCEPTANCE CRITERIA

- [ ] getCourses() utility exists with caching
- [ ] Admin updates price → payment page reflects within 24h
- [ ] /api/courses returns paginated list with cache headers
- [ ] /explore page no longer imports hard-coded COURSES
- [ ] /payment/[courseId] fetches price from API
- [ ] Graceful fallback if DB unavailable
- [ ] 80%+ test coverage
- [ ] All existing tests pass

---

## 7. REVIEWER CHECKLIST

- [ ] Code follows existing patterns
- [ ] Error handling graceful
- [ ] Cache invalidation logic sound
- [ ] Tests cover happy path + edge cases
- [ ] No performance regressions
- [ ] No breaking changes to API

---

## 8. RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| DB query slower than hard-coded | Cache hits most; fallback to seed |
| Students see stale price | Document 24h cache; add bypass param |
| API consumers break | Format stays same (additive only) |
| Seed data falls out of sync | One-time seed migration then remove |

**Next:** Proceed to implementation.
