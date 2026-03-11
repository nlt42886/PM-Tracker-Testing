'use strict';

const { getStatus } = require('./logic');

// Fix "today" to 15 Jan 2025 so all daysDiff calculations are deterministic.
const FIXED_TODAY = '2025-01-15';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${FIXED_TODAY}T12:00:00.000Z`));
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Helper ─────────────────────────────────────────────────────────────────

/** Returns a minimal task object. */
function task(id, freq) {
  return { id, freq };
}

/** Returns a state map where `taskId` has the given nextDue date. */
function stateWith(taskId, nextDue) {
  return { [taskId]: { nextDue, history: [] } };
}

// ── pending ────────────────────────────────────────────────────────────────

describe('getStatus – pending', () => {
  test('returns "pending" when there is no state entry for the task', () => {
    expect(getStatus(task('t1', '1w'), {})).toBe('pending');
  });

  test('returns "pending" when state entry exists but nextDue is null', () => {
    expect(getStatus(task('t1', '1w'), { t1: { nextDue: null, history: [] } })).toBe('pending');
  });

  test('returns "pending" when state entry exists but nextDue is undefined', () => {
    expect(getStatus(task('t1', '1w'), { t1: { history: [] } })).toBe('pending');
  });
});

// ── overdue ────────────────────────────────────────────────────────────────

describe('getStatus – overdue', () => {
  test('returns "overdue" when nextDue is yesterday', () => {
    expect(getStatus(task('t1', '1m'), stateWith('t1', '2025-01-14'))).toBe('overdue');
  });

  test('returns "overdue" when nextDue is 30 days in the past', () => {
    expect(getStatus(task('t1', '1m'), stateWith('t1', '2024-12-16'))).toBe('overdue');
  });

  test('returns "overdue" when nextDue is 1 year in the past', () => {
    expect(getStatus(task('t1', '1y'), stateWith('t1', '2024-01-15'))).toBe('overdue');
  });
});

// ── due-soon thresholds ────────────────────────────────────────────────────

describe('getStatus – due-soon thresholds', () => {

  // freq ≤ 7 days  → soonDays = 3

  describe('weekly tasks (freq ≤ 7 days → 3-day warning)', () => {
    test('returns "due-soon" when nextDue is today (diff = 0)', () => {
      expect(getStatus(task('t1', '1w'), stateWith('t1', FIXED_TODAY))).toBe('due-soon');
    });

    test('returns "due-soon" when nextDue is 3 days away (boundary)', () => {
      expect(getStatus(task('t1', '1w'), stateWith('t1', '2025-01-18'))).toBe('due-soon');
    });

    test('returns "ok" when nextDue is 4 days away (just outside boundary)', () => {
      expect(getStatus(task('t1', '1w'), stateWith('t1', '2025-01-19'))).toBe('ok');
    });

    test('applies same 3-day threshold for a 7d custom frequency', () => {
      expect(getStatus(task('t1', '7d'), stateWith('t1', '2025-01-18'))).toBe('due-soon');
      expect(getStatus(task('t1', '7d'), stateWith('t1', '2025-01-19'))).toBe('ok');
    });
  });

  // freq ≤ 60 days → soonDays = 7

  describe('monthly tasks (freq ≤ 60 days → 7-day warning)', () => {
    test('returns "due-soon" when nextDue is 7 days away (boundary)', () => {
      expect(getStatus(task('t1', '1m'), stateWith('t1', '2025-01-22'))).toBe('due-soon');
    });

    test('returns "ok" when nextDue is 8 days away (just outside boundary)', () => {
      expect(getStatus(task('t1', '1m'), stateWith('t1', '2025-01-23'))).toBe('ok');
    });

    test('applies same 7-day threshold for 2mo frequency (60 days, boundary)', () => {
      expect(getStatus(task('t1', '2mo'), stateWith('t1', '2025-01-22'))).toBe('due-soon');
      expect(getStatus(task('t1', '2mo'), stateWith('t1', '2025-01-23'))).toBe('ok');
    });
  });

  // freq ≤ 180 days → soonDays = 14

  describe('quarterly tasks (freq ≤ 180 days → 14-day warning)', () => {
    test('returns "due-soon" for 3mo freq when nextDue is 14 days away (boundary)', () => {
      expect(getStatus(task('t1', '3mo'), stateWith('t1', '2025-01-29'))).toBe('due-soon');
    });

    test('returns "ok" for 3mo freq when nextDue is 15 days away', () => {
      expect(getStatus(task('t1', '3mo'), stateWith('t1', '2025-01-30'))).toBe('ok');
    });

    test('returns "due-soon" for 6mo freq when nextDue is 14 days away (boundary)', () => {
      expect(getStatus(task('t1', '6mo'), stateWith('t1', '2025-01-29'))).toBe('due-soon');
    });
  });

  // freq > 180 days → soonDays = 30

  describe('annual tasks (freq > 180 days → 30-day warning)', () => {
    test('returns "due-soon" for 1y freq when nextDue is 30 days away (boundary)', () => {
      expect(getStatus(task('t1', '1y'), stateWith('t1', '2025-02-14'))).toBe('due-soon');
    });

    test('returns "ok" for 1y freq when nextDue is 31 days away', () => {
      expect(getStatus(task('t1', '1y'), stateWith('t1', '2025-02-15'))).toBe('ok');
    });

    test('applies same 30-day threshold for 2y frequency', () => {
      expect(getStatus(task('t1', '2y'), stateWith('t1', '2025-02-14'))).toBe('due-soon');
      expect(getStatus(task('t1', '2y'), stateWith('t1', '2025-02-15'))).toBe('ok');
    });
  });
});

// ── ok ─────────────────────────────────────────────────────────────────────

describe('getStatus – ok', () => {
  test('returns "ok" when task is well within its schedule', () => {
    expect(getStatus(task('t1', '1m'), stateWith('t1', '2025-03-01'))).toBe('ok');
  });

  test('returns "ok" for annual task with 6 months until due', () => {
    expect(getStatus(task('t1', '1y'), stateWith('t1', '2025-07-15'))).toBe('ok');
  });
});
