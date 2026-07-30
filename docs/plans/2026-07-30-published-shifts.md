# Published Shifts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let ops preview and publish an exported volunteer-shifts CSV, then let authenticated members browse the entire published camp schedule.

**Architecture:** Parse the CSV in the browser into a strict public row shape and publish one atomic Convex document containing the current schedule. A shared schedule table renders both the ops preview and member page, with client-side sorting and filtering.

**Tech Stack:** Next.js App Router, React, TypeScript, Convex, Papa Parse, Vitest, Testing Library.

### Task 1: CSV parsing and schedule view model

**Files:**
- Create: `src/lib/shifts/types.ts`
- Create: `src/lib/shifts/csv.ts`
- Create: `src/lib/shifts/csv.test.ts`
- Create: `src/lib/shifts/view.ts`
- Create: `src/lib/shifts/view.test.ts`

1. Write failing tests for public-field extraction, date normalization, unassigned rows, malformed CSV, filtering, and sorting.
2. Run the tests and confirm they fail because the modules do not exist.
3. Implement the smallest parser and view helpers that satisfy the tests.
4. Run the targeted tests.

### Task 2: Published schedule backend

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/shifts.ts`
- Modify: `convex/schema.test.ts`
- Create: `convex/shifts.test.ts`

1. Write failing schema and handler tests.
2. Add the single-document published schedule table.
3. Add an authenticated member query and ops-password-protected replacement mutation.
4. Run the targeted backend tests.

### Task 3: Shared and route UI

**Files:**
- Create: `src/components/shifts/ShiftsTable.tsx`
- Create: `src/components/shifts/ShiftsTable.test.tsx`
- Create: `src/app/shifts/page.tsx`
- Create: `src/app/ops/shifts/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/ops/layout.tsx`

1. Write failing component tests for filters, sorting, unassigned display, and clear filters.
2. Build the shared responsive table.
3. Build the authenticated member route and ops upload/preview/publish route.
4. Add member and ops navigation links.
5. Run component tests.

### Task 4: Verification

1. Run all unit/component tests.
2. Run lint.
3. Run the production build, including Convex code generation.
4. Fix regressions and repeat all checks.
