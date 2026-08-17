import { describe, expect, it } from 'vitest';
import { chipBreakdown, chipCount, formatChips, isAllowed, roundToAllowed, type ChipRules } from './chips';

const free: ChipRules = { maxChips: null, evenDollars: false };
const even: ChipRules = { maxChips: null, evenDollars: true };

describe('chipBreakdown', () => {
  it('uses the fewest chips', () => {
    expect(chipBreakdown(1275)).toEqual([
      { denomination: 1000, count: 1 },
      { denomination: 100, count: 2 },
      { denomination: 25, count: 3 },
    ]);
    expect(chipCount(1275)).toBe(6);
  });

  it('formats stacks', () => {
    expect(formatChips(chipBreakdown(150))).toBe('1×$100 + 2×$25');
  });
});

describe('isAllowed', () => {
  it('honours the chip limit', () => {
    expect(isAllowed(75, { maxChips: 3, evenDollars: false })).toBe(true);
    expect(isAllowed(75, { maxChips: 2, evenDollars: false })).toBe(false);
    expect(isAllowed(125, { maxChips: 2, evenDollars: false })).toBe(true);
  });

  it('honours the even-dollar rule', () => {
    expect(isAllowed(30, even)).toBe(true);
    expect(isAllowed(25, even)).toBe(false);
  });
});

describe('roundToAllowed', () => {
  it('rounds to whole dollars when unrestricted', () => {
    expect(roundToAllowed(137.4, 25, 500, free)).toBe(137);
  });

  it('rounds to even dollars', () => {
    expect(roundToAllowed(137.4, 25, 500, even)).toBe(138);
    expect(roundToAllowed(25.2, 25, 500, even)).toBe(26);
  });

  it('clamps to the table limits', () => {
    expect(roundToAllowed(5, 25, 500, free)).toBe(25);
    expect(roundToAllowed(5000, 25, 500, free)).toBe(500);
  });

  it('snaps to simplified chip amounts', () => {
    const rules: ChipRules = { maxChips: 2, evenDollars: false };
    expect(roundToAllowed(140, 25, 500, rules)).toBe(125);
    expect(roundToAllowed(190, 25, 500, rules)).toBe(200);
    expect(chipCount(roundToAllowed(340, 25, 500, rules) ?? 0)).toBeLessThanOrEqual(2);
  });

  it('breaks ties downward', () => {
    expect(roundToAllowed(62.5, 25, 500, { maxChips: 1, evenDollars: false })).toBe(25);
  });

  it('returns null when no amount satisfies the rules', () => {
    expect(roundToAllowed(50, 25, 60, { maxChips: 1, evenDollars: true })).toBeNull();
  });
});
