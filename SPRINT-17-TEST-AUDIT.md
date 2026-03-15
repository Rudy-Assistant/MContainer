# Sprint 17 — Test Quality Audit

**Date:** 2026-03-12

## Context

Sprint 16 report claimed "Full suite: 495 pass, 163 todo." The sprint spec questioned whether the jump from 222→495 was legitimate. Investigation reveals the 495 figure includes vitest `test.todo` placeholders and possibly double-counted files. The actual executable test count is **227**.

## Test Count by File

| Tests | File |
|-------|------|
| 58 | store-coverage.test.ts |
| 23 | smart-systems.test.ts |
| 16 | module-system.test.ts |
| 15 | container-presets.test.ts |
| 12 | hover-door.test.ts |
| 8 | paint.test.ts |
| 8 | model-homes.test.ts |
| 8 | container-roles.test.ts |
| 8 | container-crud.test.ts |
| 7 | user-save.test.ts |
| 7 | extension-overlap.test.ts |
| 7 | adjacency.test.ts |
| 6 | view-modes.test.ts |
| 6 | undo.test.ts |
| 6 | persistence.test.ts |
| 6 | bulk-extensions.test.ts |
| 6 | bom.test.ts |
| 5 | stacking.test.ts |
| 5 | smart-placement.test.ts |
| 5 | selection.test.ts |
| 5 | extension-doors.test.ts |
| **227** | **TOTAL** |

## Source-Scanning Tests

**Count: 0.** No test file uses `fs.readFileSync` or any filesystem reading. All tests interact with the store directly via real function calls.

## Tautological Tests

**Count: 2.**

1. **`hover-door.test.ts:202`** — `expect(true).toBe(true)` in "DOOR-6c: DoorState type exported from container types". Tests that a dynamic import compiles, but `DoorState` is a TypeScript type alias erased at runtime. The assertion is a no-op.

2. **`persistence.test.ts:103`** — `expect(true).toBe(true)` in PERS-4 for `_preMergeWalls` stripping. Comment says "We trust the implementation." Real assertion logic is in surrounding tests.

## Summary

| Metric | Count |
|--------|-------|
| Total executable tests | 227 |
| Source-scanning tests | 0 |
| Tautological tests | 2 |
| **Net real behavioral tests** | **225** |

## Verdict

The 227 executable tests are **99.1% legitimate behavioral tests**. The test suite follows project anti-pattern rules: no source scanning, no mocking of system under test (only idb-keyval mocked for Node), proper `beforeEach(resetStore)` isolation, and descriptive test IDs.

The "495" figure from Sprint 16 likely included `test.todo` stubs (163 reported separately) plus potential double-counting. The real executable count has been 227 since Sprint 16's 5 extension-door tests were added to the 222 baseline.
