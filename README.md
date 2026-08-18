# blackjack-betting-strategy

Browser tool that turns a blackjack true count into a chip-legal bet recommendation using the Kelly criterion, bounded by the
table limits and by how much attention you are willing to attract.

## Running it

```bash
pnpm install
pnpm dev
```

Then open the printed localhost URL. `pnpm build` emits a static site into `dist/`; it needs no server beyond a file host.

## The model

**Edge.** The player edge is linear in the true count: `edge(TC) = edgeAtZero + edgePerTrueCount × TC`. Defaults are −0.5% at
TC 0 and +0.5% per true count, so the game breaks even at TC +1.

**Kelly.** The full-Kelly wager on one hand is `bankroll × edge / variance`, with variance per unit wagered defaulting to 1.32
(typical for a hand including doubles and splits). The Kelly fraction scales this down; half Kelly is a common choice.

**Two hands.** Two simultaneous hands are correlated, so two hands of `f × B` carry the same risk as one hand of `B`. The
two-hand size factor `f` defaults to 0.73. Every dollar figure the tool calls a *wager* is this one-hand-equivalent risk, which
is why the money actually on the felt is larger when spreading to two hands. The tool splits to two hands once the
one-hand-equivalent wager exceeds a settable fraction of the table maximum (default 75%), because a single hand cannot exceed
the table maximum and a max bet on one hand is conspicuous.

**Heat.** You choose the true count at which you are willing to have the maximum bet out on two hands. The tool builds a ramp
proportional to the edge, scaled so that it lands exactly on two max bets at that count, and never bets more than that ramp
allows. Set the count low for an aggressive spread, high to keep the ramp flat and quiet. The recommendation is the smaller of
the Kelly wager and the heat ramp, and the table tells you which one is binding.

## Chips

Bets are made from $1, $5, $25, $100, $500, and $1000 chips, and the recommendation shows the stack to push out. The stack is
always the fewest chips that make the amount: take the largest chip that fits in what is left and repeat. Because the
denominations form a divisibility chain, no other stack makes the same amount with fewer chips.

- **Simplify bets** rounds the bet down to the largest whole-dollar amount, at or below the Kelly or heat target, that the
  rules below allow. Overbetting Kelly raises risk of ruin far faster than underbetting costs expected value, so this is on by
  default; turned off, the rules below are ignored and the bet is the target rounded to the nearest dollar.
- **Even dollar bets** keeps every bet divisible by 2 so a 3:2 blackjack pays a whole number of dollars. On its own this costs
  at most $1 of bet. On by default.
- **Max denominations** caps how many chip denominations the bet's stack may show. Fewer denominations give rounder,
  camouflage-friendly amounts - with two denominations a $274 target becomes $250 rather than an obviously calculated figure.
  Defaults to 2.

A bet must satisfy every enabled rule at once, judged on its fewest-chips stack, and the rules interact: an even-dollar target
of $135 capped at three denominations cannot take the usual $1 repair to $134, because $100 + $25 + $5 + 4×$1 shows four
denominations, so the bet falls to $130 = $100 + $25 + $5.

The table minimum is the one thing that outranks "never exceed the target": a target below it is raised to the smallest
allowed bet instead. Conflicting settings are reported above the form - for example, an even-dollar bet at a $25 table minimum
cannot round down to $24, so the smallest legal bet becomes $26.

## Development

```bash
pnpm test
pnpm lint
pnpm format
```

`pnpm build` type-checks with `tsc --noEmit` before bundling with Vite.
