# Contributing

## Setup

Node 24. Either install it locally or open the repo in the provided
devcontainer, which is Alpine with node, git, the GitHub CLI and coverage.py
for the fixture. Then:

```sh
npm install
```

## Layout

- `src/ports.ts`: interfaces for everything the action needs from the outside,
  meaning inputs, outputs, annotations, the pull request and the filesystem.
- `src/adapters.ts`: those interfaces implemented with `@actions/*` and node.
- `src/diff.ts`: which lines a unified diff adds.
- `src/coverage.ts`: reading `coverage json` and intersecting it with a diff.
- `src/report.ts`: rendering the comment.
- `src/coverage-comment.ts`: the reporting logic and `main`, written only
  against the ports.
- `src/action.ts`: the entry point, wiring the adapters into `main`.
- `tests/`: vitest suites. `tests/support/fakes.ts` has in-memory ports, so the
  logic is tested without network or filesystem access.
- `tests/fixtures/project`: a two-function Python package with one uncovered
  branch, which the integration test measures to produce a real report.

Read [CONVENTIONS.md](CONVENTIONS.md) before changing any of it.

## Working on it

```sh
npm test           # vitest
npm run pack       # format, lint, typecheck and rebuild dist/
```

`dist/index.js` is committed: GitHub runs it directly, without installing
dependencies. CI fails when it does not match the sources, so run `npm run
pack` and commit the result with any source change.

## Releasing

Push a `v*` tag. The release workflow rebuilds `dist/`, checks it matches the
tag's sources, and drafts a release for review.
