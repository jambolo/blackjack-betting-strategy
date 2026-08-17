/** Casino chip denominations available for making a bet. */
export const DENOMINATIONS = [1, 5, 25, 100, 500, 1000] as const;

export type Denomination = (typeof DENOMINATIONS)[number];

export interface ChipStack {
  readonly denomination: Denomination;
  readonly count: number;
}

export interface ChipRules {
  /** Maximum number of chips allowed in a single bet, or null for no restriction. */
  readonly maxChips: number | null;
  /** Restrict bets to even dollar amounts so a 3:2 blackjack pays whole dollars. */
  readonly evenDollars: boolean;
}

/** Greedy decomposition is optimal for this denomination set (it is canonical). */
export function chipBreakdown(amount: number): ChipStack[] {
  let remaining = Math.max(0, Math.round(amount));
  const stacks: ChipStack[] = [];
  for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
    const denomination = DENOMINATIONS[i]!;
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      stacks.push({ denomination, count });
      remaining -= count * denomination;
    }
  }
  return stacks;
}

/** Fewest chips that can make the amount. */
export function chipCount(amount: number): number {
  return chipBreakdown(amount).reduce((total, stack) => total + stack.count, 0);
}

export function formatChips(stacks: ChipStack[]): string {
  return stacks.map((s) => `${s.count}×$${s.denomination}`).join(' + ');
}

const comboCache = new Map<number, number[]>();

/** Every amount makeable with at most `maxChips` chips, ascending. */
function amountsWithAtMost(maxChips: number): number[] {
  const cached = comboCache.get(maxChips);
  if (cached) return cached;

  const sums = new Set<number>();
  const walk = (start: number, chipsLeft: number, total: number): void => {
    if (total > 0) sums.add(total);
    if (chipsLeft === 0) return;
    for (let i = start; i < DENOMINATIONS.length; i++) {
      walk(i, chipsLeft - 1, total + DENOMINATIONS[i]!);
    }
  };
  walk(0, Math.max(0, Math.floor(maxChips)), 0);

  const amounts = [...sums].sort((a, b) => a - b);
  comboCache.set(maxChips, amounts);
  return amounts;
}

export function isAllowed(amount: number, rules: ChipRules): boolean {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  if (rules.evenDollars && amount % 2 !== 0) return false;
  if (rules.maxChips !== null && chipCount(amount) > rules.maxChips) return false;
  return true;
}

/** Allowed amounts within [min, max], ascending. Unbounded chip counts yield every legal dollar amount. */
export function allowedAmounts(rules: ChipRules, min: number, max: number): number[] {
  const step = rules.evenDollars ? 2 : 1;
  if (rules.maxChips === null) {
    const lo = Math.ceil(min / step) * step;
    const hi = Math.floor(max / step) * step;
    const amounts: number[] = [];
    for (let value = Math.max(lo, step); value <= hi; value += step) amounts.push(value);
    return amounts;
  }
  return amountsWithAtMost(rules.maxChips).filter((v) => v >= min && v <= max && (!rules.evenDollars || v % 2 === 0));
}

/**
 * Nearest legal bet to `target` within [min, max]. Ties round down.
 * Returns null when the rules admit no amount in the range.
 */
export function roundToAllowed(target: number, min: number, max: number, rules: ChipRules): number | null {
  if (max < min) return null;

  if (rules.maxChips === null) {
    const step = rules.evenDollars ? 2 : 1;
    const lo = Math.max(Math.ceil(min / step) * step, step);
    const hi = Math.floor(max / step) * step;
    if (hi < lo) return null;
    const snapped = Math.round(target / step) * step;
    return Math.min(hi, Math.max(lo, snapped));
  }

  const candidates = allowedAmounts(rules, min, max);
  const first = candidates[0];
  if (first === undefined) return null;

  let best = first;
  let bestDistance = Math.abs(first - target);
  for (const value of candidates) {
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      best = value;
      bestDistance = distance;
    }
  }
  return best;
}
