import { describe, expect, it } from 'vitest';
import {
  DENOMINATIONS,
  chipBreakdown,
  chipCount,
  chipValue,
  denominationCount,
  formatChips,
  isAllowed,
  selectBet,
  selectChips,
  type ChipRules,
} from './chips';

const free: ChipRules = { simplify: true, evenDollars: false, maxDenominations: DENOMINATIONS.length };
const even: ChipRules = { ...free, evenDollars: true };
const exact: ChipRules = { ...free, simplify: false };
const capped = (maxDenominations: number, evenDollars = false): ChipRules => ({ simplify: true, evenDollars, maxDenominations });

describe('chipBreakdown', () => {
  it('uses the fewest chips', () => {
    expect(chipBreakdown(1275)).toEqual([
      { denomination: 1000, count: 1 },
      { denomination: 100, count: 2 },
      { denomination: 25, count: 3 },
    ]);
    expect(chipCount(1275)).toBe(6);
    expect(denominationCount(1275)).toBe(3);
  });

  it('never exceeds the amount asked for', () => {
    expect(chipValue(chipBreakdown(137.9))).toBe(137);
  });

  it('formats stacks', () => {
    expect(formatChips(chipBreakdown(150))).toBe('1×$100 + 2×$25');
  });
});

describe('isAllowed', () => {
  it('honours the even-dollar rule', () => {
    expect(isAllowed(30, even)).toBe(true);
    expect(isAllowed(25, even)).toBe(false);
    expect(isAllowed(25, free)).toBe(true);
    expect(isAllowed(0, free)).toBe(false);
  });

  it('judges the denomination cap on the fewest-chips stack', () => {
    // 274 could be paid under any cap in $1 chips, but its real stack shows four colours.
    expect(isAllowed(274, capped(4))).toBe(true);
    expect(isAllowed(274, capped(2))).toBe(false);
    expect(isAllowed(250, capped(2))).toBe(true);
  });

  it('ignores every rule when not simplifying', () => {
    expect(isAllowed(273, { ...exact, evenDollars: true, maxDenominations: 1 })).toBe(true);
  });
});

describe('selectChips', () => {
  it('hits the target exactly when the rules allow it', () => {
    expect(chipValue(selectChips(487, free))).toBe(487);
    expect(chipValue(selectChips(488, even))).toBe(488);
  });

  it('costs exactly one dollar to make an odd target even when denominations are unrestricted', () => {
    for (const amount of [25, 75, 137, 475, 999]) {
      const stacks = selectChips(amount, even);
      expect(chipValue(stacks)).toBe(amount - 1);
      expect(stacks).toEqual(chipBreakdown(amount - 1));
    }
  });

  it('rounds down to the cap-friendly amount below', () => {
    expect(selectChips(274, capped(2))).toEqual([
      { denomination: 100, count: 2 },
      { denomination: 25, count: 2 },
    ]);
    expect(chipValue(selectChips(999, capped(1)))).toBe(500);
  });

  it('skips the $1 parity repair when it would open too many denominations', () => {
    // $134 = $100 + $25 + $5 + 4×$1 shows four colours, so the even bet under $135 falls to $130.
    expect(selectChips(135, capped(3, true))).toEqual([
      { denomination: 100, count: 1 },
      { denomination: 25, count: 1 },
      { denomination: 5, count: 1 },
    ]);
  });

  it('has no even bet below $2', () => {
    expect(selectChips(1, even)).toEqual([]);
  });
});

describe('selectBet', () => {
  it('rounds down to whole dollars', () => {
    expect(selectBet(137.4, 25, 500, free)).toBe(137);
    expect(selectBet(137.4, 25, 500, even)).toBe(136);
  });

  it('rounds to the nearest dollar when not simplifying', () => {
    expect(selectBet(137.4, 25, 500, exact)).toBe(137);
    expect(selectBet(137.6, 25, 500, exact)).toBe(138);
    expect(selectBet(5000, 25, 500, exact)).toBe(500);
  });

  it('keeps a target that already sits on a whole dollar', () => {
    expect(selectBet(150, 25, 500, free)).toBe(150);
    expect(selectBet(0.1 + 0.2 + 149.7, 25, 500, free)).toBe(150);
  });

  it('clamps to the table limits', () => {
    expect(selectBet(5, 25, 500, free)).toBe(25);
    expect(selectBet(5000, 25, 500, free)).toBe(500);
  });

  it('raises to the smallest legal bet when the table minimum is odd', () => {
    // $24 is below the table minimum, so the even rule has to push up instead of down.
    expect(selectBet(25, 25, 500, even)).toBe(26);
    expect(selectBet(5, 25, 500, even)).toBe(26);
  });

  it('raises past amounts the denomination cap rejects', () => {
    // $27..$49 all need two colours; $50 = 2×$25 is the smallest single-colour bet above $27.
    expect(selectBet(10, 27, 500, capped(1))).toBe(50);
  });

  it('returns null when the limits admit nothing legal', () => {
    expect(selectBet(25, 25, 25, even)).toBeNull();
    expect(selectBet(100, 50, 40, free)).toBeNull();
  });
});
