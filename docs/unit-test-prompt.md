# Prompt — Add Unit Tests

*Copy-paste this into a coding agent (or hand to a teammate) to add unit tests to this repo.*

---

You are working in the **CATS — Centralian Attendance & Timestamping System** monorepo
(React 19 + Vite + TypeScript frontend, Supabase backend, ESP32 firmware).
This change is frontend-only: **add a unit test harness and tests for the pure,
mocking-free logic first.**

## Context

- No test framework is installed yet (`package.json` scripts are only `dev`, `build`,
  `lint`, `preview`). You must add one and document it.
- Stack: React 19.2, Vite 8.1, TypeScript ~6.0.2, Tailwind 4 (via `@tailwindcss/vite`).
  Choose a Vitest version **compatible with Vite 8** (verify; use the latest Vitest 4.x
  line if that's what supports Vite 8). Add `vitest` (and `@testing-library/react`,
  `@testing-library/jest-dom`, `jsdom` for later component tests) to `devDependencies`.
- Add a `"test": "vitest run"` script (and `"test:watch": "vitest"`) to `package.json`.
- Co-locate tests as `*.test.ts` next to the source file (e.g.
  `src/lib/utils/composition.test.ts`). Do NOT introduce a separate `__tests__` dir
  unless it's clearly better.
- Do not add test files that require network access (no real Supabase requests).
  Service/API tests must mock the `supabase` client singleton from `src/lib/supabase.ts`.

## Scope — Phase 1 (pure functions, no mocking)

Write thorough unit tests for these existing pure modules:

1. `src/lib/utils/result.ts` — `Ok()` / `Err()` constructors and the `Result<T, E>`
   discriminated union. Test shape (`ok: true` vs `ok: false`), type narrowing, and
   that values/errors round-trip untouched.
2. `src/lib/utils/composition.ts` — `pipe()` (all declared arities 2/3/4 and the
   variadic fallback) executes left-to-right and threads the value through each
   function; `compose()` executes right-to-left. Include a type-safe usage that
   proves overloads resolve.
3. `src/lib/utils/attendanceReducer.ts` — `attendanceReducer(state, event)`:
   - updates only the matching student's status;
   - leaves other students untouched (reference equality for non-matching elements);
   - does NOT mutate the input `state` or its `students` array (deep-freeze input
     and assert no throw + result differs / input unchanged);
   - returns a new roster array (not the same reference).
4. `src/lib/utils/courseSearch.ts` — `matchesCourseSearch(term)`:
   - empty/whitespace term matches every course;
   - case-insensitive match on `name`, `stub`, and `instructor`;
   - non-matching term returns false;
   - trims surrounding whitespace in the term.
5. `src/services/validation.ts` — `validateUid(nfcUid, students)`:
   - known UID → `Ok` with the student;
   - unknown UID → `Err({ reason: "UNKNOWN_UID", nfcUid })`;
   - does not mutate the students array.

## Conventions

- Mirror the repo's existing pure-FP style: no classes, no globals, no `any`.
- Test names: `it("...", ...)` describing behavior in plain English (e.g.
  `it("returns Err with UNKNOWN_UID reason when the uid is not registered")`).
- Keep tests deterministic — no `Math.random`, no timers that aren't faked.

## Acceptance criteria

- `npm test` (i.e. `vitest run`) passes with the new tests.
- `npm run build` (`tsc -b && vite build`) still passes — tests are type-checked.
- `npm run lint` still passes; if the lint config must ignore test files, note exactly
  why and keep the ignore as narrow as possible (prefer compiling them, not ignoring).
- No test hits the network; no `supabase` real calls in Phase 1.
- Report: which Vitest version you pinned and why, and a one-line list of files added.