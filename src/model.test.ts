import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  breakEvenCount,
  edgeAt,
  fullKellyBet,
  heatCapBet,
  ramp,
  recommend,
  tableCeiling,
  unitSize,
  validate,
  type Params,
} from './model';

const base: Params = DEFAULT_PARAMS;

describe('edge model', () => {
  it('is linear in the true count', () => {
    expect(edgeAt(base, 0)).toBeCloseTo(-0.005);
    expect(edgeAt(base, 4)).toBeCloseTo(0.015);
  });

  it('breaks even where the edge crosses zero', () => {
    expect(breakEvenCount(base)).toBeCloseTo(1);
    expect(fullKellyBet(base, 1)).toBe(0);
    expect(fullKellyBet(base, 0)).toBe(0);
  });

  it('sizes the full Kelly bet as bankroll × edge / variance', () => {
    expect(fullKellyBet(base, 5)).toBeCloseTo((40000 * 0.02) / 1.3);
  });
});

describe('unit size', () => {
  it('is the Kelly wager added per +0.5% of edge', () => {
    expect(unitSize(base)).toBeCloseTo((0.005 * 40000) / 1.3);
    // With the default edge-per-true-count of 0.5%, it matches the Kelly increment per true count.
    expect(unitSize(base)).toBeCloseTo(fullKellyBet(base, 5) - fullKellyBet(base, 4));
  });

  it('scales with the Kelly fraction', () => {
    expect(unitSize({ ...base, kellyFraction: 0.5 })).toBeCloseTo(unitSize(base) / 2);
  });
});

describe('heat ramp', () => {
  it('reaches two hands at the table maximum exactly at the heat count', () => {
    expect(heatCapBet(base, base.heatCount)).toBeCloseTo(tableCeiling(base));
    const r = recommend(base, base.heatCount);
    expect(r.hands).toBe(2);
    expect(r.betPerHand).toBe(base.maxBet);
    expect(r.totalWagered).toBe(2 * base.maxBet);
  });

  it('scales proportionally to the edge below the heat count', () => {
    const half = (base.heatCount + breakEvenCount(base)) / 2;
    expect(heatCapBet(base, half)).toBeCloseTo(tableCeiling(base) / 2);
  });

  it('caps bets above the heat count at the table maximum', () => {
    const r = recommend(base, base.heatCount + 4);
    expect(r.hands).toBe(2);
    expect(r.betPerHand).toBe(base.maxBet);
    expect(r.limit).toBe('table-max');
  });

  it('is ignored when the heat count sits below break-even', () => {
    const p: Params = { ...base, heatCount: 0 };
    expect(heatCapBet(p, 5)).toBe(Number.POSITIVE_INFINITY);
    expect(validate(p).some((w) => w.includes('break-even'))).toBe(true);
  });
});

describe('recommend', () => {
  it('bets the smallest legal bet with no edge', () => {
    const r = recommend(base, -2);
    expect(r.hands).toBe(1);
    // The default even-dollar rule lifts the odd $25 table minimum to $26.
    expect(r.betPerHand).toBe(26);
    expect(r.limit).toBe('table-min');
  });

  it('follows Kelly when the bankroll is the tighter constraint', () => {
    const p: Params = { ...base, bankroll: 10000, evenDollars: false, maxDenominations: 6 };
    const r = recommend(p, 4);
    expect(r.limit).toBe('kelly');
    expect(r.betPerHand).toBe(Math.floor((10000 * 0.015) / 1.3));
    expect(r.hands).toBe(1);
  });

  it('never bets above the target', () => {
    const p: Params = { ...base, bankroll: 100000 };
    for (const tc of [2, 3, 4, 5, 6, 7]) {
      const r = recommend(p, tc);
      if (r.limit !== 'table-min') expect(r.equivalent).toBeLessThanOrEqual(r.target + 1e-9);
    }
  });

  it('follows the heat ramp when it is the tighter constraint', () => {
    const p: Params = { ...base, bankroll: 400000 };
    const r = recommend(p, 4);
    expect(r.limit).toBe('heat');
    expect(r.totalWagered).toBeLessThanOrEqual(2 * p.maxBet);
  });

  it('applies the Kelly fraction', () => {
    const half: Params = { ...base, bankroll: 10000, kellyFraction: 0.5, evenDollars: false, maxDenominations: 6 };
    expect(recommend(half, 4).betPerHand).toBe(Math.floor((10000 * 0.015) / 1.3 / 2));
  });

  it('spreads to two hands above the trigger, keeping equivalent risk', () => {
    const p: Params = { ...base, bankroll: 100000 };
    const r = recommend(p, 5);
    expect(r.hands).toBe(2);
    expect(r.betPerHand).toBeCloseTo(Math.round(r.target * p.twoHandFactor), 0);
    expect(r.equivalent).toBeCloseTo(r.betPerHand / p.twoHandFactor);
    expect(r.totalWagered).toBeGreaterThan(r.equivalent);
  });

  it('shows the chips that make the bet exactly', () => {
    const r = recommend({ ...base, bankroll: 10000 }, 4);
    expect(r.chips.reduce((total, s) => total + s.denomination * s.count, 0)).toBe(r.betPerHand);
  });

  it('keeps even bets even', () => {
    const p: Params = { ...base, bankroll: 10000, evenDollars: true };
    expect(recommend(p, 4).betPerHand % 2).toBe(0);
  });

  it('honours the denomination cap when simplifying', () => {
    // Kelly target is $113 = 1×$100 + 2×$5 + 3×$1; two denominations round it down to $110.
    const p: Params = { ...base, bankroll: 9800, evenDollars: false, maxDenominations: 2 };
    expect(recommend(p, 4).betPerHand).toBe(110);
  });

  it('rounds to the nearest dollar when not simplifying', () => {
    const p: Params = { ...base, bankroll: 10000, simplifyBets: false };
    expect(recommend(p, 4).betPerHand).toBe(115);
  });
});

describe('ramp', () => {
  it('covers the requested range', () => {
    const rows = ramp(base, { from: -1, to: 5, step: 1 });
    expect(rows).toHaveLength(7);
    expect(rows[0]?.trueCount).toBe(-1);
    expect(rows.at(-1)?.trueCount).toBe(5);
  });

  it('never decreases the bet as the count rises', () => {
    const rows = ramp(base, { from: -3, to: 12, step: 0.5 });
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.equivalent).toBeGreaterThanOrEqual(rows[i - 1]!.equivalent - 1e-9);
    }
  });
});

describe('validate', () => {
  it('accepts the defaults, noting the even-dollar minimum', () => {
    expect(validate(base)).toEqual(['Chip rules raise the smallest legal bet from $25 to $26.']);
  });

  it('reports impossible chip rules', () => {
    const p: Params = { ...base, evenDollars: true, minBet: 25, maxBet: 25 };
    expect(validate(p).some((w) => w.includes('No bet'))).toBe(true);
  });

  it('reports a max below the min', () => {
    expect(validate({ ...base, maxBet: 10 }).some((w) => w.includes('below the minimum'))).toBe(true);
  });

  it('reports an unusable denomination cap', () => {
    expect(validate({ ...base, maxDenominations: 0 }).some((w) => w.includes('Max denominations'))).toBe(true);
    expect(validate({ ...base, maxDenominations: 0, simplifyBets: false })).toEqual([]);
  });
});
