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

Bets are made from $1, $5, $25, $100, $500, and $1000 chips, and the recommendation shows the stack to push out.

- **Simplify bets** restricts a bet to 1, 2, or 3 chips total, giving a ramp of camouflage-friendly amounts such as $25, $125,
  $200, $500 instead of exact figures like $274.
- **Even dollar bets** keeps every bet divisible by 2 so a 3:2 blackjack pays a whole number of dollars.
- **Round down** resolves rounding downward so a rounded bet never exceeds the Kelly or heat target. Overbetting Kelly raises
  risk of ruin far faster than underbetting costs expected value, so this is on by default; turn it off to round to the nearest
  legal amount instead.

Conflicting settings are reported above the form — for example, a $25 table minimum combined with 1-chip even-dollar bets has
no legal amount below $100.

## Development

```bash
pnpm test
pnpm lint
pnpm format
```

`pnpm build` type-checks with `tsc --noEmit` before bundling with Vite.
