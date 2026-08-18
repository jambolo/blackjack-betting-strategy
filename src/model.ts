import { DENOMINATIONS, chipBreakdown, selectBet, type ChipRules, type ChipStack } from './chips';

export interface Params {
  /** Total playing bankroll in dollars. */
  readonly bankroll: number;
  /** Fraction of full Kelly to bet (1 = full Kelly). */
  readonly kellyFraction: number;
  readonly minBet: number;
  readonly maxBet: number;
  /** Player edge at true count 0, as a decimal (e.g. -0.005). */
  readonly edgeAtZero: number;
  /** Additional edge per +1 true count, as a decimal (e.g. 0.005). */
  readonly edgePerTrueCount: number;
  /** Variance per unit wagered on one hand (~1.32 for typical rules). */
  readonly variance: number;
  /** Per-hand size, as a fraction of the one-hand bet, that keeps risk equal when playing two hands. */
  readonly twoHandFactor: number;
  /** Spread to two hands once the one-hand bet exceeds this fraction of the table maximum. */
  readonly twoHandTrigger: number;
  /** True count at which two hands are played at the table maximum (heat ceiling). */
  readonly heatCount: number;
  /** Round bets down to simpler amounts; gates the two rules below. */
  readonly simplifyBets: boolean;
  readonly evenDollars: boolean;
  /** Most denominations a bet may show when simplifying, 1 to DENOMINATIONS.length. */
  readonly maxDenominations: number;
}

export type Limit = 'table-min' | 'heat' | 'kelly' | 'table-max';

export interface Recommendation {
  readonly trueCount: number;
  readonly edge: number;
  /** Full-Kelly one-hand-equivalent wager. */
  readonly fullKelly: number;
  /** Kelly wager after applying the Kelly fraction. */
  readonly kelly: number;
  /** One-hand-equivalent wager permitted by the heat ramp. */
  readonly heatCap: number;
  /** One-hand-equivalent wager targeted before chip rounding. */
  readonly target: number;
  readonly hands: 1 | 2;
  readonly betPerHand: number;
  readonly totalWagered: number;
  /** One-hand-equivalent risk of the rounded bet. */
  readonly equivalent: number;
  /** Rounded bet as a fraction of full Kelly. */
  readonly kellyRatio: number;
  readonly chips: ChipStack[];
  readonly limit: Limit;
}

export const DEFAULT_PARAMS: Params = {
  bankroll: 40000,
  kellyFraction: 1,
  minBet: 25,
  maxBet: 500,
  edgeAtZero: -0.005,
  edgePerTrueCount: 0.005,
  variance: 1.32,
  twoHandFactor: 0.73,
  twoHandTrigger: 0.75,
  heatCount: 6,
  simplifyBets: true,
  evenDollars: true,
  maxDenominations: 2,
};

export function chipRules(p: Params): ChipRules {
  return { simplify: p.simplifyBets, evenDollars: p.evenDollars, maxDenominations: p.maxDenominations };
}

export function edgeAt(p: Params, trueCount: number): number {
  return p.edgeAtZero + p.edgePerTrueCount * trueCount;
}

/** True count at which the player edge crosses zero. */
export function breakEvenCount(p: Params): number {
  return p.edgePerTrueCount === 0 ? Number.NaN : -p.edgeAtZero / p.edgePerTrueCount;
}

/** Full-Kelly one-hand wager: bankroll × edge / variance. */
export function fullKellyBet(p: Params, trueCount: number): number {
  const edge = edgeAt(p, trueCount);
  if (edge <= 0 || p.variance <= 0) return 0;
  return (p.bankroll * edge) / p.variance;
}

/**
 * Heat ramp: a wager schedule proportional to edge, scaled so that the heat count lands
 * exactly on two hands at the table maximum.
 */
export function heatCapBet(p: Params, trueCount: number): number {
  const edgeAtHeat = edgeAt(p, p.heatCount);
  if (edgeAtHeat <= 0) return Number.POSITIVE_INFINITY; // heat count is below break-even; ramp is meaningless
  const edge = edgeAt(p, trueCount);
  if (edge <= 0) return 0;
  return (p.maxBet / p.twoHandFactor) * (edge / edgeAtHeat);
}

/** One-hand-equivalent risk of the largest bet the table allows: two hands at the maximum. */
export function tableCeiling(p: Params): number {
  return p.maxBet / p.twoHandFactor;
}

export function recommend(p: Params, trueCount: number): Recommendation {
  const rules = chipRules(p);
  const edge = edgeAt(p, trueCount);
  const fullKelly = fullKellyBet(p, trueCount);
  const kelly = fullKelly * p.kellyFraction;
  const heatCap = heatCapBet(p, trueCount);
  const ceiling = tableCeiling(p);

  const desired = Math.min(kelly, heatCap);
  const target = Math.min(desired, ceiling);

  let limit: Limit;
  if (target <= p.minBet) limit = 'table-min';
  else if (desired > ceiling + 1e-9) limit = 'table-max';
  else if (heatCap < kelly) limit = 'heat';
  else limit = 'kelly';

  const spread = target > p.twoHandTrigger * p.maxBet;
  const hands: 1 | 2 = spread ? 2 : 1;
  const raw = spread ? target * p.twoHandFactor : target;

  const betPerHand = selectBet(raw, p.minBet, p.maxBet, rules) ?? 0;
  const equivalent = hands === 2 ? betPerHand / p.twoHandFactor : betPerHand;

  return {
    trueCount,
    edge,
    fullKelly,
    kelly,
    heatCap,
    target,
    hands,
    betPerHand,
    totalWagered: betPerHand * hands,
    equivalent,
    kellyRatio: fullKelly > 0 ? equivalent / fullKelly : Number.NaN,
    chips: chipBreakdown(betPerHand),
    limit,
  };
}

export interface RampRange {
  readonly from: number;
  readonly to: number;
  readonly step: number;
}

const MAX_ROWS = 200;

export function ramp(p: Params, range: RampRange): Recommendation[] {
  const step = range.step > 0 ? range.step : 1;
  const rows: Recommendation[] = [];
  for (let tc = range.from; tc <= range.to + 1e-9 && rows.length < MAX_ROWS; tc += step) {
    rows.push(recommend(p, Math.round(tc * 1000) / 1000));
  }
  return rows;
}

/** Configuration problems worth showing the user. Empty means the inputs are coherent. */
export function validate(p: Params): string[] {
  const warnings: string[] = [];
  if (p.bankroll <= 0) warnings.push('Bankroll must be greater than 0.');
  if (p.minBet <= 0) warnings.push('Minimum bet must be greater than 0.');
  if (p.maxBet < p.minBet) warnings.push('Maximum bet is below the minimum bet.');
  if (p.variance <= 0) warnings.push('Variance must be greater than 0.');
  if (p.twoHandFactor <= 0 || p.twoHandFactor > 1) warnings.push('Two-hand factor must be between 0 and 1.');
  if (p.edgePerTrueCount <= 0) warnings.push('Edge per true count must be greater than 0.');
  else if (p.heatCount <= breakEvenCount(p)) {
    warnings.push(`Heat count must be above the break-even count (${breakEvenCount(p).toFixed(1)}); the ramp is ignored.`);
  }

  const badDenominations =
    p.simplifyBets &&
    (!Number.isInteger(p.maxDenominations) || p.maxDenominations < 1 || p.maxDenominations > DENOMINATIONS.length);
  if (badDenominations) {
    warnings.push(`Max denominations must be a whole number from 1 to ${DENOMINATIONS.length}.`);
    return warnings;
  }

  const rules = chipRules(p);
  const lowest = selectBet(p.minBet, p.minBet, p.maxBet, rules);
  if (lowest === null) warnings.push('No bet between the table minimum and maximum satisfies the chip rules.');
  else if (lowest !== p.minBet) warnings.push(`Chip rules raise the smallest legal bet from $${p.minBet} to $${lowest}.`);

  const highest = selectBet(p.maxBet, p.minBet, p.maxBet, rules);
  if (highest !== null && highest !== p.maxBet) {
    warnings.push(`Chip rules lower the largest legal bet from $${p.maxBet} to $${highest}.`);
  }
  return warnings;
}
