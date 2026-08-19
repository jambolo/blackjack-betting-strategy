# Blackjack Betting Calculator

Browser tool that turns a blackjack true count into a chip-legal bet recommendation using the Kelly criterion, bounded by the
table limits and by how much attention you are willing to attract.

## Overview

Given a true count, the tool computes the bet to make right now — rendered as an actual stack of chips, not just a dollar
figure — and a ramp table showing that bet across a range of counts. Four ideas drive the recommendation.

**Edge.** The player's edge is modeled as linear in the true count, so a higher count implies a larger edge and a larger
optimal wager.

**The Kelly criterion.** Kelly sizes each wager as a fraction of bankroll proportional to edge divided by variance. It is the
staking strategy that maximizes a bankroll's long-run exponential growth rate, because it balances the upside of a favorable
bet against the compounding damage of the variance around it: betting less than Kelly leaves growth on the table, and betting
more than Kelly increases variance faster than it increases growth, up to a point where it destroys the bankroll altogether.
The tool computes the full-Kelly wager and lets it be scaled down by a Kelly fraction, which trades some growth rate for a
smoother bankroll trajectory.

**A heat ramp and table limits.** Kelly alone would size a bet from edge and bankroll with no regard for how it looks or what
the table allows. A heat ramp caps the wager as a function of true count so that it reaches the table maximum only at a
count the player chooses, and the table minimum and maximum bound it on both ends. The recommended bet is always the most
conservative of these constraints, and the app reports which one is binding at each count.

**Bet simplification.** A bet sized to the last cent of a Kelly calculation is impractical. Simplification rounds the computed wager down to a chip-legal amount that is easy to count out and
recognize, reducing the computation the player has to do at the table without giving up meaningful expected value.

## The model

**Edge.** The player edge is linear in the true count: `edge(TC) = edgeAtZero + edgePerTrueCount × TC`. Defaults are −0.5% at
TC 0 and +0.5% per true count, so the game breaks even at TC +1.

**Kelly.** The full-Kelly wager on one hand is `bankroll × edge / variance`, with variance per unit wagered defaulting to 1.3
(typical for rules including 6 decks, doubles and splits). The value is generally considered to be risky, so the Kelly fraction scales this down; 50% and 25% Kelly are common choices.

**Two hands.** Two simultaneous hands are correlated, so two hands of `f × B` carry the same risk as one hand of `B`. The
two-hand size factor `f` defaults to 0.73. Every dollar figure the tool calls a *wager* is this one-hand-equivalent risk, which
is why the money actually on the felt is larger when spreading to two hands. The tool splits to two hands once the
one-hand-equivalent wager exceeds a settable fraction of the table maximum (default 75%), because a single hand cannot exceed
the table maximum and a max bet on one hand is conspicuous.

**Heat.** You choose the true count at which you are willing to have the maximum bet out on two hands. The tool builds a ramp
proportional to the edge, scaled so that it lands exactly on two max bets at that count, and never bets more than that ramp
allows. Set the count low for an aggressive spread, high to keep the ramp flat and quiet. The recommendation is the smaller of
the Kelly wager and the heat ramp, and the table tells you which one is binding.

**Fixed assumptions.** Everything above is a setting. These are not - they are baked into the code and would need a code
change, not a form change, to alter:

- **The edge is linear in true count.** Only its intercept and slope are configurable; there is no way to express a curve
  (e.g. diminishing returns at high counts).
- **Variance is a single constant**, not a function of true count, deck penetration, or rules. One number is assumed to hold
  across the whole shoe.
- **Bet spreading tops out at two hands.** The heat ramp and two-hand factor only ever produce a 1-hand or 2-hand
  recommendation, even at tables that would allow three or more.
- **Chip denominations** are $1, $5, $25, $100, $500, and $1000 (see below). Simplification and the chip stack shown for a
  bet are both built from this fixed set.

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
