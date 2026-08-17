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
    expect(fullKellyBet(base, 5)).toBeCloseTo((40000 * 0.02) / 1.32);
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
  it('bets the table minimum with no edge', () => {
    const r = recommend(base, -2);
    expect(r.hands).toBe(1);
    expect(r.betPerHand).toBe(base.minBet);
    expect(r.limit).toBe('table-min');
  });

  it('follows Kelly when the bankroll is the tighter constraint', () => {
    const p: Params = { ...base, bankroll: 10000 };
    const r = recommend(p, 4);
    expect(r.limit).toBe('kelly');
    expect(r.betPerHand).toBe(Math.floor((10000 * 0.015) / 1.32));
    expect(r.hands).toBe(1);
  });

  it('never bets above the target when rounding down', () => {
    const p: Params = { ...base, bankroll: 100000, simplifyBets: true, maxChips: 2 };
    for (const tc of [2, 3, 4, 5, 6, 7]) {
      const r = recommend(p, tc);
      if (r.limit !== 'table-min') expect(r.equivalent).toBeLessThanOrEqual(r.target + 1e-9);
    }
  });

  it('can round to the nearest legal bet instead', () => {
    const p: Params = { ...base, bankroll: 100000, simplifyBets: true, maxChips: 2, rounding: 'nearest' };
    expect(recommend(p, 5).betPerHand).toBe(500);
  });

  it('follows the heat ramp when it is the tighter constraint', () => {
    const p: Params = { ...base, bankroll: 400000 };
    const r = recommend(p, 4);
    expect(r.limit).toBe('heat');
    expect(r.totalWagered).toBeLessThanOrEqual(2 * p.maxBet);
  });

  it('applies the Kelly fraction', () => {
    const half: Params = { ...base, bankroll: 10000, kellyFraction: 0.5 };
    expect(recommend(half, 4).betPerHand).toBe(Math.floor((10000 * 0.015) / 1.32 / 2));
  });

  it('spreads to two hands above the trigger, keeping equivalent risk', () => {
    const p: Params = { ...base, bankroll: 100000 };
    const r = recommend(p, 5);
    expect(r.hands).toBe(2);
    expect(r.betPerHand).toBeCloseTo(Math.round(r.target * p.twoHandFactor), 0);
    expect(r.equivalent).toBeCloseTo(r.betPerHand / p.twoHandFactor);
    expect(r.totalWagered).toBeGreaterThan(r.equivalent);
  });

  it('honours the chip rules', () => {
    const p: Params = { ...base, bankroll: 10000, simplifyBets: true, maxChips: 2 };
    const r = recommend(p, 4);
    expect(r.chips.reduce((n, s) => n + s.count, 0)).toBeLessThanOrEqual(2);
  });

  it('keeps even bets even', () => {
    const p: Params = { ...base, bankroll: 10000, evenDollars: true };
    expect(recommend(p, 4).betPerHand % 2).toBe(0);
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
  it('accepts the defaults', () => {
    expect(validate(base)).toEqual([]);
  });

  it('reports impossible chip rules', () => {
    const p: Params = { ...base, simplifyBets: true, maxChips: 1, evenDollars: true, minBet: 25, maxBet: 60 };
    expect(validate(p).some((w) => w.includes('No bet'))).toBe(true);
  });

  it('reports a max below the min', () => {
    expect(validate({ ...base, maxBet: 10 }).some((w) => w.includes('below the minimum'))).toBe(true);
  });
});
