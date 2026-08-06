# Versioned Training Modules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add authenticated, code-managed training modules with durable versioned progress and an interactive Leave No Trace module.

**Architecture:** Module content lives in typed TypeScript definitions registered by slug. Convex stores member progress and completion against an exact module version, while Next.js routes render the catalog and reusable module runner inside the existing authenticated member experience.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Convex Auth/database, Vitest, Testing Library.

### Task 1: Define and register training modules

**Files:**
- Create: `src/lib/training/types.ts`
- Create: `src/lib/training/lnt.ts`
- Create: `src/lib/training/modules.ts`
- Test: `src/lib/training/modules.test.ts`

1. Write failing tests for module lookup, version policy, and LNT content structure.
2. Run `npm test -- src/lib/training/modules.test.ts` and verify failure.
3. Implement the typed registry and LNT content.
4. Run the focused test and verify it passes.

### Task 2: Persist authenticated progress and completion

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/training.ts`
- Test: `convex/training.test.ts`

1. Write failing tests for authentication, upsert/resume, version isolation, and idempotent completion.
2. Run `npm test -- convex/training.test.ts` and verify failure.
3. Add `training_progress` schema and Convex query/mutations.
4. Run the focused test and verify it passes.
5. Run `npx convex codegen`.

### Task 3: Build the reusable LNT module runner

**Files:**
- Create: `src/components/training/LntModuleRunner.tsx`
- Test: `src/components/training/LntModuleRunner.test.tsx`

1. Write failing interaction tests for gating, checklist, quiz retry, role branching, and pledge completion.
2. Run the focused test and verify failure.
3. Implement the responsive React runner with semantic controls and saved progress.
4. Run the focused test and verify it passes.

### Task 4: Add authenticated training routes

**Files:**
- Create: `src/app/training/page.tsx`
- Create: `src/app/training/lnt/page.tsx`
- Test: `src/app/training/page.test.tsx`

1. Write failing tests for catalog status and authentication states.
2. Run the focused test and verify failure.
3. Implement the catalog and LNT route following existing member auth patterns.
4. Run focused tests and verify they pass.

### Task 5: Surface training on the dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Test: `src/app/dashboard/page.test.tsx`

1. Write a failing test for the Training dashboard entry.
2. Run the focused test and verify failure.
3. Add a visible Training link/card with member status.
4. Run the focused test and verify it passes.

### Task 6: Verify the complete feature

1. Run `npm test -- --run` and require all tests to pass.
2. Run `npm run lint` and fix new issues.
3. Run `npm run build` and require a successful production build.
4. Review the final diff for scope, accessibility, and accidental changes.
