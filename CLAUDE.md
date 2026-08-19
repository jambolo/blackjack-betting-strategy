# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Uses pnpm (see `packageManager` in package.json).

- `pnpm dev` — Vite dev server
- `pnpm build` — type-check (`tsc --noEmit`) then bundle to `dist/`
- `pnpm test` — run all tests (Vitest)
- `pnpm vitest run src/model.test.ts` — run one test file; add `-t "name"` to filter by test name
- `pnpm lint` — ESLint
- `pnpm format` / `pnpm format:check` — Prettier (CI checks formatting on PRs)

## Architecture

A static, no-framework browser tool: TypeScript + Vite, no runtime dependencies. Logic and UI are strictly separated:

- [src/chips.ts](src/chips.ts) — pure chip arithmetic. Denominations ($1…$1000) form a divisibility chain, so the greedy fewest-chips breakdown is optimal. `ChipRules` (simplify / even dollars / max denominations) are judged on the fewest-chips stack, and `selectBet` finds the largest legal amount at or below a target within table limits — the table minimum being the only thing allowed to push a bet *above* its target.
- [src/model.ts](src/model.ts) — betting math: linear edge in true count, full-Kelly wager, heat ramp, and `recommend()` which combines them (the binding constraint is reported as `limit`). `validate()` returns user-facing warnings for incoherent settings.
- [src/main.ts](src/main.ts) — the only DOM code. Reads inputs by id from [index.html](index.html), re-renders everything on any input event, persists `Params` to localStorage (merged over `DEFAULT_PARAMS` on load).
- [src/format.ts](src/format.ts) — display formatting only.

Tests are colocated (`*.test.ts`) and cover only the pure modules.

**Central invariant:** every wager in model.ts is a *one-hand-equivalent* risk. Two simultaneous hands are correlated, so two hands of `f × B` (f = `twoHandFactor`, default 0.73) carry the same risk as one hand of `B`. `recommend()` works in one-hand-equivalent terms throughout and only converts to a per-hand dollar amount at the end — which is why `totalWagered` on two hands exceeds the target. The README explains the model in depth; keep it in sync with model changes.

Percent-like `Params` fields (`kellyFraction`, edges, `twoHandTrigger`) are decimals in code but percentages in the UI; main.ts converts at the read/write boundary.

## Branching and release

Git-flow style: `develop` is the default branch (PRs target it); releases merge to `master`. Pushing a `package.json` change to `master` triggers CD, which tags `v<version>`, deploys `dist/` to GitHub Pages, and merges `master` back into `develop`.
