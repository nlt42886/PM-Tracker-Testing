# Test Coverage Analysis — PM Tracker

## Executive Summary

The codebase currently has **0% automated test coverage**.  There is no test
runner, no test files, and no CI/CD pipeline.  Every function is embedded
directly inside `index.html`, making them non-importable by a test framework
without extraction.

This document identifies the highest-value areas for new tests, documents bugs
discovered during the analysis, and describes the refactoring needed to make the
code sustainably testable.

A working Jest test suite has been added under `tests/` as a starting point.

---

## Current State

| Metric | Value |
|---|---|
| Test files | 0 |
| Test framework | None |
| CI/CD | None |
| Package manager | None (no `package.json`) |
| Code structure | All logic embedded in `index.html` |
| Estimated coverage | 0% |

---

## Recommended Test Setup

**Framework:** [Jest](https://jestjs.io/) — zero-config, excellent mocking
support, and a large ecosystem.

```
npm install --save-dev jest
npm test           # runs all tests
npm run test:coverage  # generates a coverage report
```

A `package.json` and initial test files have been added in this PR.

---

## Priority Areas for New Tests

### P1 — Date & Scheduling Logic (Highest Priority)

These are pure functions with no side effects.  They are the **core business
logic** of the application — a bug here silently causes wrong due dates for
every PM task across every machine.

| Function | Why it needs tests |
|---|---|
| `calcNextDue(fromDateStr, freq)` | Drives all task rescheduling; must handle legacy codes, custom codes, month-end clamping, and leap years |
| `calcNextDueCustom(fromDateStr, freq)` | Used for all custom-format frequencies; has a known month-end overflow bug (see Bugs below) |
| `freqTotalDays(freq)` | Determines "due-soon" warning windows; wrong values cause missed or premature alerts |
| `daysDiff(dateStr)` | Every status calculation depends on this; off-by-one here = wrong overdue count everywhere |
| `formatDate(dateStr)` | Used in every UI display and the PDF report |
| `dateFromStr` / `strFromDate` | Round-trip correctness is a prerequisite for all scheduling |

**Suggested test file:** `tests/frequency.test.js` (already added)

Key scenarios to cover:

- Each frequency type (`1w`, `1m`, `2m`, `3m`, `6m`, `1y`, `Xd`, `Xw`, `Xmo`, `Xy`)
- Month-end clamping: Jan 31 + 1 month → Feb 28/29 (not March 2/3)
- Leap year handling: Feb 29 source date + 1 year → Mar 1 (JS roll-over)
- Year boundary: Dec 15 + 1 month → Jan 15 next year
- Unknown / malformed frequency codes (fallback behaviour)

---

### P2 — Status Determination Logic (Highest Priority)

`getStatus(task)` is called for every card render, every stat count, and every
badge.  Its correctness is critical because it directly drives the "overdue" and
"due soon" alerts that maintenance staff rely on.

The function has **four tiered thresholds** based on frequency length that have
never been validated by a test:

| Frequency range | Warning window |
|---|---|
| ≤ 7 days  | 3 days  |
| ≤ 60 days | 7 days  |
| ≤ 180 days | 14 days |
| > 180 days | 30 days |

**Suggested test file:** `tests/status.test.js` (already added)

Key scenarios to cover:

- `pending` when no state or no `nextDue`
- `overdue` when `daysDiff < 0`
- `due-soon` exactly at each threshold boundary (diff === soonDays)
- `ok` one day beyond each boundary (diff === soonDays + 1)
- Each frequency category (weekly, monthly, bimonthly, quarterly, semiannual, annual)

---

### P3 — Machine & State Management (High Priority)

These functions manage all persistent data via `localStorage`.  A silent failure
here wipes or corrupts the entire maintenance history.

| Function | Why it needs tests |
|---|---|
| `loadMachines()` | Must return `DEFAULT_MACHINES` on first load; must recover from corrupt JSON |
| `saveMachines()` | Must serialise correctly — the saved JSON must round-trip back |
| `getActiveMachineId()` | Must fall back gracefully when stored ID refers to a deleted machine |
| `deleteMachine(id)` | Must prevent deleting the last machine; must switch active machine if active is deleted |
| `saveMachine()` | Add and edit paths; must not accept empty names |
| `saveCustomPM()` | Must normalise the legacy `'1w'`/`'1m'` freq codes vs new `'Xmo'`/`'Xd'` codes |

**Suggested test file:** `tests/machineManagement.test.js` (already added)

These tests require a **localStorage mock**.  The recommended pattern:

```js
function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem:    (key)        => store[key] ?? null,
    setItem:    (key, value) => { store[key] = String(value); },
    removeItem: (key)        => { delete store[key]; },
  };
}
```

---

### P4 — Data Migration (Medium Priority)

`runMigrations()` runs once on startup and modifies stored data.  An incorrect
migration silently deletes machines or tasks.

| Scenario | Expected behaviour |
|---|---|
| `machine_antihaze` exists | Remove it; save; switch active machine if needed |
| `machine_vti4` does not exist | Add it with the full task list; save |
| Both conditions at once | Handle atomically; call save once |
| No changes needed | Do not call save; return `activeMachineId` unchanged |

**Suggested test file:** `tests/machineManagement.test.js` (already added)

---

### P5 — Import / Export (Medium Priority)

These functions move all user data in and out; data loss here is irreversible.

| Function | Key scenarios |
|---|---|
| `exportData()` | Output JSON contains a `machines` key; `exportedAt` timestamp is present |
| `importData(event)` | Valid backup restores all machines; invalid JSON shows error; missing `machines` key shows error; empty file is handled |

These functions interact with the DOM (`Blob`, `URL.createObjectURL`,
`FileReader`) so they require **jsdom** (Jest's default browser environment) or
integration tests.  A lightweight approach is to extract the data-transformation
logic into a pure helper and test that separately.

---

### P6 — Device ID (Low Priority)

`generateDeviceId()` is a pure function with a clear specification:

- Always starts with `"PM-"`
- Exactly 11 characters total
- Uses only the unambiguous character set (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
- Never includes `O`, `I`, `0`, or `1`

**Suggested test file:** `tests/machineManagement.test.js` (already added)

---

### P7 — UI Rendering (Lower Priority)

The rendering functions (`renderAll`, `renderHistory`, `updateStats`,
`renderManagePanel`) manipulate the DOM directly and are currently untestable
without a real browser or a DOM emulation layer.

**Recommended approach:**
1. Install `jest-environment-jsdom` and set `"testEnvironment": "jsdom"` for
   these tests.
2. Load `index.html` with `document.innerHTML = ...` or use a tool like
   [Playwright](https://playwright.dev/) for end-to-end tests.
3. Assert on element text content, visibility flags, and CSS classes.

**High-value assertions to start with:**

| Function | What to assert |
|---|---|
| `updateStats()` | Overdue/soon/ok/pending counts match the actual task states |
| `renderAll()` | Correct panel shown for each tab; empty-state rendered for no tasks |
| `renderHistory()` | Entries sorted newest-first; tech filter shows correct subset |
| `showToast()` | Element gets the correct class and message |

---

## Bugs Discovered During Analysis

### Bug 1 — `calcNextDueCustom` does not clamp month-end dates

**Severity:** Medium
**Affected frequencies:** `2mo`, `3mo`, `6mo` (all tasks that use the `mo` unit)

When a task is completed on the 31st of a month and the next period ends in a
month with fewer days, JavaScript's `Date.setMonth()` rolls the date over into
the following month instead of clamping to the last valid day.

```
calcNextDueCustom('2025-01-31', '3mo')
  → JavaScript: Jan 31 + 3 months = Apr 31 → overflows to May 1
  → Expected:   Apr 30  (last day of April)
```

The legacy `addMonths()` helper in `calcNextDue` handles this correctly by
computing `Math.min(day, daysInMonth)`.  `calcNextDueCustom` should do the same.

A test documenting this limitation has been added in `tests/frequency.test.js`
(marked as `KNOWN LIMITATION`).

---

### Bug 2 — Dead code in `calcNextDue` for `1w` and `1y` frequencies

**Severity:** Low (no functional impact, but misleading)

The guard at the top of `calcNextDue` routes **all** regex-matching codes to
`calcNextDueCustom` before the legacy branches run:

```js
if (/^\d+(d|w|mo|y)$/.test(freq)) return calcNextDueCustom(fromDateStr, freq);
// ↓ these lines are unreachable for '1w' and '1y':
if (freq === '1w') { ... }
if (freq === '1y') { ... }
```

Both `'1w'` and `'1y'` match the regex and are handled correctly by
`calcNextDueCustom`.  The legacy branches should be removed to avoid confusion.

---

### Bug 3 — Dead legacy codes in `freqTotalDays` (`2m`, `3m`, `6m`)

**Severity:** Low (no functional impact)

`freqTotalDays` has hardcoded cases for `'2m'`, `'3m'`, and `'6m'`, but no
actual task in the application uses these codes.  All multi-month tasks use the
custom format (`'2mo'`, `'3mo'`, `'6mo'`), which fall through to the regex path.
The hardcoded cases are dead code and should be removed.

---

### Bug 4 — `freqCodeToLabel` does not handle legacy `1m` format

**Severity:** Low

`freqCodeToLabel('1m')` returns `'1m'` unchanged because the single-character
`'m'` suffix is not in the regex `/^\d+(d|w|mo|y)$/`.  Any place in the UI that
calls `freqCodeToLabel` with a legacy-format code will display the raw code
string rather than a human-readable label.  Currently this is unlikely to
surface because the manage-panel shows `task.freqLabel` (stored at creation
time), but it is a latent display bug.

---

## Refactoring Recommendations for Testability

### 1. Extract logic into a standalone ES module

All business logic should be moved from `index.html` into a dedicated
`src/logic.js` file:

```
src/
  logic.js      ← pure business logic (no DOM, no localStorage)
tests/
  logic.js      ← delete this workaround file
  *.test.js
index.html      ← imports src/logic.js via <script type="module">
```

This is the single highest-leverage change: it eliminates the need to maintain
a parallel extracted copy in `tests/logic.js` and immediately makes all logic
testable without any further changes.

### 2. Inject side-effect dependencies

Functions that call `localStorage` or read from global `machines` should accept
their dependencies as parameters (or via a context object).  This pattern is
already demonstrated in the extracted test module:

```js
// Before (hard to test):
function loadMachines() {
  const r = localStorage.getItem(LS_MACHINES);
  ...
}

// After (easy to test):
function loadMachines(storage = localStorage) {
  const r = storage.getItem(LS_MACHINES);
  ...
}
```

### 3. Add a CI workflow

A minimal GitHub Actions workflow would run tests on every push:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
```

---

## Test File Inventory

| File | Tests added | Area covered |
|---|---|---|
| `tests/logic.js` | — | Extracted module for testability |
| `tests/dateUtils.test.js` | 16 | `dateFromStr`, `strFromDate`, `formatDate`, `daysDiff` |
| `tests/frequency.test.js` | 38 | `calcNextDue`, `calcNextDueCustom`, `freqTotalDays`, `freqCodeToLabel` |
| `tests/status.test.js` | 22 | `getStatus` (all statuses and threshold boundaries) |
| `tests/machineManagement.test.js` | 22 | `loadMachines`, `saveMachines`, `getActiveMachineId`, `generateDeviceId`, `runMigrations` |
| **Total** | **98 tests** | |

---

## Quick Start

```bash
npm install
npm test
npm run test:coverage
```
