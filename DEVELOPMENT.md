# Development

This document describes how to set up a development environment, build the tool, and release it.

## Overview

The tool is a static, no-framework browser app: TypeScript bundled by Vite, with no runtime
dependencies. Everything ships as static files in `dist/`.

## Prerequisites

- **Node.js** — 24 or later (`engines` enforces `>=24`; CI uses `lts/*`).
- **pnpm** — the version is pinned by the `packageManager` field in `package.json`
  (currently pnpm 11.x). pnpm 10+ switches to the pinned version automatically; alternatively,
  Corepack works too:

  ```sh
  corepack enable
  ```

No other tools are required; TypeScript, Vite, Vitest, ESLint, and Prettier are all installed as
dev dependencies.

### TypeScript 7 dual install

TypeScript 7 (the native Go compiler) ships no stable programmatic API until 7.1, so tools that
need the API — typescript-eslint and editor tooling — can't use it directly. This project uses
the setup Microsoft recommends in the
[TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/):

- `@typescript/native` (alias of `typescript@7`) provides the fast native `tsc` used by
  `pnpm build` for type checking.
- `typescript` (alias of `@typescript/typescript6`) provides the TypeScript 6.0 JS API (and a
  `tsc6` binary) for typescript-eslint and VS Code's bundled TypeScript extension.

When TypeScript 7.1 ships its stable API and typescript-eslint supports it, collapse this back to
a single `typescript` dependency.

### VS Code

Editor config is not committed (`.vscode/` is git-ignored), so set this up once per clone: run
**TypeScript: Select TypeScript Version → Use Workspace Version** so IntelliSense uses the
project's TypeScript instead of VS Code's bundled copy — or install the
[TypeScript 7 extension](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview)
for the native language server. The ESLint and Prettier extensions are also recommended.

## Setup

```sh
git clone <your clone URL>
cd blackjack-betting-strategy
pnpm install
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the Vite dev server with hot reload |
| `pnpm build` | Type-check (`tsc --noEmit`) then bundle to `dist/` |
| `pnpm preview` | Serve the production build from `dist/` locally |
| `pnpm test` | Run all tests once (Vitest) |
| `pnpm coverage` | Run tests with V8 coverage (lcov report in `coverage/`) |
| `pnpm lint` | ESLint |
| `pnpm format` | Format everything with Prettier |
| `pnpm format:check` | Verify formatting without writing (what CI runs) |

To run a single test file:

```sh
pnpm vitest run src/model.test.ts
```

Add `-t "name"` to filter by test name.

## Project layout

```text
index.html        Page markup; inputs are read by id from main.ts
src/
  chips.ts        Pure chip arithmetic (denominations, bet selection)
  model.ts        Betting math (edge, Kelly, heat ramp, recommend())
  main.ts         The only DOM code; renders and persists to localStorage
  format.ts       Display formatting
  *.test.ts       Tests, colocated with the pure modules they cover
vite.config.ts    Relative base path (./), output to dist/, ES2022 target
```

See [CLAUDE.md](CLAUDE.md) for architecture notes and the central one-hand-equivalent invariant,
and the [README](README.md) for the betting model itself. Keep the README in sync with any model
changes.

## Branching model

Git-flow style:

- **`develop`** — the default branch. All PRs target it.
- **`release/*`** — cut from `develop` to prepare a release.
- **`master`** — release branch; merging to it triggers deployment (see below).

## Continuous integration

[`ci.yml`](.github/workflows/ci.yml) runs on pushes to `master`, `develop`, and `release/**`, and
on all pull requests:

- **Build & Test** — `pnpm build` and `pnpm test` on Ubuntu and Windows.
- **Lint & Format** (PRs only) — `pnpm lint` and `pnpm format:check`. Run `pnpm format` before
  pushing so this passes.
- **Coverage** (`develop` only) — uploads an lcov report to Codecov.

## Releasing and deployment

Deployment is automated by [`cd.yml`](.github/workflows/cd.yml), which triggers on any push to
`master` that changes `package.json`. To release:

1. Cut a `release/vX.Y.Z` branch from `develop`.
2. Bump `version` in `package.json` on that branch.
3. Merge the release branch into `master` (via PR or merge) and push.

The CD workflow then:

1. Builds and tests.
2. Tags the commit `v<version>` from `package.json` (skipped if the tag already exists, so
   re-runs and non-version `package.json` changes won't re-release).
3. Builds `dist/` and deploys it to the repository's GitHub Pages site
   (`https://<owner>.github.io/<repo>/`).
4. Merges `master` back into `develop`.

There is no manual deploy step; GitHub Pages serves whatever the last CD run uploaded.

The workflow deploys to whichever repository it runs in, so a fork deploys to the fork owner's own
Pages site — not to the canonical one. For CD to work in a fork, enable GitHub Actions on the fork
and set the repository's Pages source to **GitHub Actions** (Settings → Pages). Codecov uploads on
`develop` need a `CODECOV_TOKEN` secret, but coverage is marked non-blocking, so CI passes without
it.
