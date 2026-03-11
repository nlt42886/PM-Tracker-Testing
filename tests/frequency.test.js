'use strict';

const {
  calcNextDue,
  calcNextDueCustom,
  freqTotalDays,
  freqCodeToLabel,
} = require('./logic');

// ── calcNextDue ────────────────────────────────────────────────────────────

describe('calcNextDue', () => {

  // ── Custom-format frequencies (routed through calcNextDueCustom) ──

  describe('custom format frequencies', () => {
    test('1w adds exactly 7 days', () => {
      expect(calcNextDue('2025-01-01', '1w')).toBe('2025-01-08');
    });

    test('2w adds exactly 14 days', () => {
      expect(calcNextDue('2025-01-01', '2w')).toBe('2025-01-15');
    });

    test('1y advances the year by 1', () => {
      expect(calcNextDue('2025-01-15', '1y')).toBe('2026-01-15');
    });

    test('2y advances the year by 2', () => {
      expect(calcNextDue('2025-06-01', '2y')).toBe('2027-06-01');
    });

    test('30d adds 30 days', () => {
      expect(calcNextDue('2025-01-01', '30d')).toBe('2025-01-31');
    });

    test('2mo advances by 2 months', () => {
      expect(calcNextDue('2025-01-15', '2mo')).toBe('2025-03-15');
    });

    test('3mo advances by 3 months', () => {
      expect(calcNextDue('2025-01-15', '3mo')).toBe('2025-04-15');
    });

    test('6mo advances by 6 months', () => {
      expect(calcNextDue('2025-01-15', '6mo')).toBe('2025-07-15');
    });
  });

  // ── Legacy-format frequencies (handled by addMonths helper) ───────

  describe('legacy format frequencies', () => {
    test('1m advances by 1 month', () => {
      expect(calcNextDue('2025-01-15', '1m')).toBe('2025-02-15');
    });

    test('1m clamps to last day of February in a non-leap year (Jan 31)', () => {
      expect(calcNextDue('2023-01-31', '1m')).toBe('2023-02-28');
    });

    test('1m clamps to last day of February in a leap year (Jan 31)', () => {
      expect(calcNextDue('2024-01-31', '1m')).toBe('2024-02-29');
    });

    test('1m clamps when advancing from March 31 to April (30 days)', () => {
      expect(calcNextDue('2025-03-31', '1m')).toBe('2025-04-30');
    });

    test('1m wraps year boundary correctly (December → January)', () => {
      expect(calcNextDue('2025-12-15', '1m')).toBe('2026-01-15');
    });

    test('2m advances by 2 months', () => {
      expect(calcNextDue('2025-01-15', '2m')).toBe('2025-03-15');
    });

    test('3m advances by 3 months', () => {
      expect(calcNextDue('2025-01-15', '3m')).toBe('2025-04-15');
    });

    test('6m advances by 6 months', () => {
      expect(calcNextDue('2025-01-15', '6m')).toBe('2025-07-15');
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    test('returns the input date unchanged for an unrecognised freq code', () => {
      expect(calcNextDue('2025-06-01', 'unknown')).toBe('2025-06-01');
    });

    test('1y handles non-leap year Feb 29 source date (rolls to Mar 1)', () => {
      // 2024 is a leap year; 2025 is not — JS Date rolls Feb 29 → Mar 1
      const result = calcNextDue('2024-02-29', '1y');
      expect(result).toBe('2025-03-01');
    });
  });
});

// ── calcNextDueCustom ──────────────────────────────────────────────────────

describe('calcNextDueCustom', () => {
  test('adds days for d suffix', () => {
    expect(calcNextDueCustom('2025-01-01', '5d')).toBe('2025-01-06');
  });

  test('adds weeks for w suffix', () => {
    expect(calcNextDueCustom('2025-01-01', '3w')).toBe('2025-01-22');
  });

  test('adds months for mo suffix', () => {
    expect(calcNextDueCustom('2025-01-15', '4mo')).toBe('2025-05-15');
  });

  test('adds years for y suffix', () => {
    expect(calcNextDueCustom('2025-01-15', '3y')).toBe('2028-01-15');
  });

  test('returns input unchanged for invalid pattern', () => {
    expect(calcNextDueCustom('2025-01-15', 'bad')).toBe('2025-01-15');
  });

  // This test documents a known limitation: calcNextDueCustom uses native
  // Date.setMonth() which can overflow into the next month on month-end dates
  // (e.g. Jan 31 + 3mo → Apr 31 overflows to May 1 instead of Apr 30).
  // The legacy addMonths() helper in calcNextDue correctly clamps to the last
  // day of the month; calcNextDueCustom does not.
  test('KNOWN LIMITATION – mo overflow on month-end dates (e.g. Jan 31 + 3mo)', () => {
    const result = calcNextDueCustom('2025-01-31', '3mo');
    // JavaScript overflows Apr 31 → May 1 instead of clamping to Apr 30.
    expect(result).toBe('2025-05-01');
    // Ideal (clamped) result would be '2025-04-30'.
    // This is a bug worth fixing; see TEST_COVERAGE_ANALYSIS.md.
  });
});

// ── freqTotalDays ──────────────────────────────────────────────────────────

describe('freqTotalDays', () => {
  // Legacy codes
  test('1w  → 7',   () => expect(freqTotalDays('1w')).toBe(7));
  test('1m  → 30',  () => expect(freqTotalDays('1m')).toBe(30));
  test('2m  → 60',  () => expect(freqTotalDays('2m')).toBe(60));
  test('3m  → 90',  () => expect(freqTotalDays('3m')).toBe(90));
  test('6m  → 180', () => expect(freqTotalDays('6m')).toBe(180));
  test('1y  → 365', () => expect(freqTotalDays('1y')).toBe(365));

  // Custom codes used in the real task data
  test('2mo → 60',  () => expect(freqTotalDays('2mo')).toBe(60));
  test('3mo → 90',  () => expect(freqTotalDays('3mo')).toBe(90));
  test('6mo → 180', () => expect(freqTotalDays('6mo')).toBe(180));
  test('2y  → 730', () => expect(freqTotalDays('2y')).toBe(730));

  // Day and week custom codes
  test('7d  → 7',   () => expect(freqTotalDays('7d')).toBe(7));
  test('14d → 14',  () => expect(freqTotalDays('14d')).toBe(14));
  test('2w  → 14',  () => expect(freqTotalDays('2w')).toBe(14));
  test('4w  → 28',  () => expect(freqTotalDays('4w')).toBe(28));

  // Unknown code falls back to 30
  test('unknown → 30 (fallback)', () => expect(freqTotalDays('unknown')).toBe(30));
});

// ── freqCodeToLabel ────────────────────────────────────────────────────────

describe('freqCodeToLabel', () => {
  describe('day labels', () => {
    test('1d  → "1 Day"',  () => expect(freqCodeToLabel('1d')).toBe('1 Day'));
    test('2d  → "2 Days"', () => expect(freqCodeToLabel('2d')).toBe('2 Days'));
    test('30d → "30 Days"',() => expect(freqCodeToLabel('30d')).toBe('30 Days'));
  });

  describe('week labels', () => {
    test('1w  → "1 Week"',  () => expect(freqCodeToLabel('1w')).toBe('1 Week'));
    test('2w  → "2 Weeks"', () => expect(freqCodeToLabel('2w')).toBe('2 Weeks'));
  });

  describe('month labels', () => {
    test('1mo → "1 Month"',  () => expect(freqCodeToLabel('1mo')).toBe('1 Month'));
    test('2mo → "2 Months"', () => expect(freqCodeToLabel('2mo')).toBe('2 Months'));
    test('3mo → "3 Months"', () => expect(freqCodeToLabel('3mo')).toBe('3 Months'));
    test('6mo → "6 Months"', () => expect(freqCodeToLabel('6mo')).toBe('6 Months'));
  });

  describe('year labels', () => {
    test('1y → "1 Year"',  () => expect(freqCodeToLabel('1y')).toBe('1 Year'));
    test('2y → "2 Years"', () => expect(freqCodeToLabel('2y')).toBe('2 Years'));
  });

  test('returns freq unchanged for unrecognised code', () => {
    expect(freqCodeToLabel('1m')).toBe('1m');  // legacy "m" is not in the regex
  });
});
