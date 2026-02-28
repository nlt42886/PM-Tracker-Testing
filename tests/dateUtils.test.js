'use strict';

const {
  dateFromStr,
  strFromDate,
  formatDate,
  daysDiff,
} = require('./logic');

// Fix "today" to 15 Jan 2025 for all date-relative assertions.
const FIXED_TODAY = '2025-01-15';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(`${FIXED_TODAY}T12:00:00.000Z`));
});

afterEach(() => {
  jest.useRealTimers();
});

// ── dateFromStr ────────────────────────────────────────────────────────────

describe('dateFromStr', () => {
  test('parses a YYYY-MM-DD string into a local Date at midnight', () => {
    const d = dateFromStr('2025-03-01');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2);   // 0-indexed → March
    expect(d.getDate()).toBe(1);
  });

  test('parses January correctly', () => {
    const d = dateFromStr('2024-01-31');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(31);
  });

  test('parses December correctly', () => {
    const d = dateFromStr('2024-12-31');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(11);  // 0-indexed → December
    expect(d.getDate()).toBe(31);
  });

  test('handles leap-year Feb 29', () => {
    const d = dateFromStr('2024-02-29');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });
});

// ── strFromDate ────────────────────────────────────────────────────────────

describe('strFromDate', () => {
  test('formats a Date object as YYYY-MM-DD', () => {
    expect(strFromDate(new Date(2025, 0, 15))).toBe('2025-01-15');
  });

  test('zero-pads single-digit month and day', () => {
    expect(strFromDate(new Date(2025, 2, 5))).toBe('2025-03-05');
  });

  test('formats December 31 correctly', () => {
    expect(strFromDate(new Date(2024, 11, 31))).toBe('2024-12-31');
  });

  test('round-trips with dateFromStr', () => {
    const original = '2025-07-04';
    expect(strFromDate(dateFromStr(original))).toBe(original);
  });
});

// ── formatDate ─────────────────────────────────────────────────────────────

describe('formatDate', () => {
  test('formats January correctly', () => {
    expect(formatDate('2025-01-01')).toBe('Jan 1, 2025');
  });

  test('formats December correctly', () => {
    expect(formatDate('2024-12-31')).toBe('Dec 31, 2024');
  });

  test('strips leading zero from day number', () => {
    expect(formatDate('2025-03-05')).toBe('Mar 5, 2025');
  });

  test('formats all twelve months', () => {
    const expected = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    expected.forEach((abbr, idx) => {
      const month = String(idx + 1).padStart(2, '0');
      expect(formatDate(`2025-${month}-15`)).toBe(`${abbr} 15, 2025`);
    });
  });
});

// ── daysDiff ───────────────────────────────────────────────────────────────

describe('daysDiff', () => {
  test('returns 0 when date equals today', () => {
    expect(daysDiff(FIXED_TODAY)).toBe(0);
  });

  test('returns positive number for a future date', () => {
    expect(daysDiff('2025-01-20')).toBe(5);
  });

  test('returns negative number for a past date', () => {
    expect(daysDiff('2025-01-10')).toBe(-5);
  });

  test('returns 1 for tomorrow', () => {
    expect(daysDiff('2025-01-16')).toBe(1);
  });

  test('returns -1 for yesterday', () => {
    expect(daysDiff('2025-01-14')).toBe(-1);
  });

  test('spans year boundary correctly', () => {
    // 2025-01-15 → 2026-01-15 should be 365 days
    expect(daysDiff('2026-01-15')).toBe(365);
  });
});
