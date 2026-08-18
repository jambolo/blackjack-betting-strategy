/** Casino chip denominations available for making a bet, ascending. */
export const DENOMINATIONS = [1, 5, 25, 100, 500, 1000] as const;

export type Denomination = (typeof DENOMINATIONS)[number];

export interface ChipStack {
  readonly denomination: Denomination;
  readonly count: number;
}

export interface ChipRules {
  /** Round down to the largest bet the rules below allow. Off, they are ignored and the bet rounds to the nearest dollar. */
  readonly simplify: boolean;
  /** Restrict bets to even dollar amounts so a 3:2 blackjack pays whole dollars. */
  readonly evenDollars: boolean;
  /** Most denominations a bet may show, 1 to DENOMINATIONS.length (no restriction). */
  readonly maxDenominations: number;
}

/**
 * Fewest chips that make `amount` exactly, largest denomination first. Take the largest chip that
 * fits in what is left, repeat. Optimal rather than merely greedy: the denominations form a
 * divisibility chain (1 | 5 | 25 | 100 | 500 | 1000), so holding back a larger chip always costs
 * at least two smaller ones to replace it.
 */
export function chipBreakdown(amount: number): ChipStack[] {
  let remaining = Math.max(0, Math.floor(amount));
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

export function chipValue(stacks: ChipStack[]): number {
  return stacks.reduce((total, stack) => total + stack.denomination * stack.count, 0);
}

/** Fewest chips that can make the amount. */
export function chipCount(amount: number): number {
  return chipBreakdown(amount).reduce((total, stack) => total + stack.count, 0);
}

/** Distinct denominations in the fewest-chips breakdown, i.e. how many chip colours the bet shows. */
export function denominationCount(amount: number): number {
  return chipBreakdown(amount).length;
}

/**
 * Whether a bet of `amount` satisfies the chip rules. The denomination cap is judged on the
 * fewest-chips stack: any amount could stay under the cap paid out in $1 chips, but the point of
 * the cap is that the stack actually pushed out looks simple.
 */
export function isAllowed(amount: number, rules: ChipRules): boolean {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  if (!rules.simplify) return true;
  if (rules.evenDollars && amount % 2 !== 0) return false;
  return chipBreakdown(amount).length <= rules.maxDenominations;
}

/**
 * Chips for the largest amount at or below `target` that satisfies the rules; empty when even $1
 * does not. The scan is short: every multiple of $1000 is a single even denomination, so allowed
 * amounts are never more than $1000 apart.
 */
export function selectChips(target: number, rules: ChipRules): ChipStack[] {
  let amount = Math.floor(target);
  while (amount > 0 && !isAllowed(amount, rules)) amount--;
  return chipBreakdown(amount);
}

export function formatChips(stacks: ChipStack[]): string {
  return stacks.map((s) => `${s.count}×$${s.denomination}`).join(' + ');
}

/**
 * Bet for `target` held inside the table limits: with `simplify` the largest allowed amount at or
 * below the target, otherwise the target rounded to the nearest dollar.
 *
 * The table minimum is the one thing that outranks "never exceed the target": you cannot bet
 * below it, so a target underneath it is raised to the smallest allowed bet instead. Returns null
 * when the limits and the chip rules together leave no legal amount.
 */
export function selectBet(target: number, min: number, max: number, rules: ChipRules): number | null {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) return null;

  if (!rules.simplify) return Math.min(hi, Math.max(lo, Math.round(target)));

  // The epsilon keeps a target that is exactly on a whole dollar from floating-point falling a dollar short.
  const capped = Math.min(Math.floor(target + 1e-9), hi);
  if (capped >= lo) {
    const value = chipValue(selectChips(capped, rules));
    if (value >= lo) return value;
  }

  for (let value = lo; value <= hi; value++) {
    if (isAllowed(value, rules)) return value;
  }
  return null;
}
