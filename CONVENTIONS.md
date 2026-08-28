# Conventions

Rules for working on this repository. They exist so that the next person to
open a file can tell what it promises without reading its body, and so that a
change that breaks a promise fails a test rather than a build somewhere else.

## Documentation comments

- Every declaration carries a documentation comment except local variables:
  exported and private alike, including interfaces, their members, types,
  constants, classes and functions.
- A type, interface or constant is described by what it **is**. A function is
  described by what it **does**, in the imperative: "Returns the lines the
  patch adds", not "This function will return".
- Say what the thing produces, meaning its return value or the side effect
  worth knowing about. "Records the coverage for later runs to read" beats
  "Baseline writer".
- Document a parameter only when its name does not already say what it is.
- Use `iff` where you mean "if and only if", and write `True iff ...` rather
  than `Whether ...` for a boolean.
- State element order when the order carries meaning, as with the line numbers
  `addedLines` returns.
- Leave needless words out. No "this function", "the given", "an object
  representing".
- Comments describe the code as it stands. Never what it used to do, what
  changed, or who asked for it. That belongs in the commit message.
- Reach for a comment when the reason is not visible in the code: why the
  baseline is written off pull requests and read on them, why a cache miss
  passes. Do not narrate what the next line plainly does.

## Contracts

- State a precondition when a caller could get it wrong and the phrasing of
  the summary does not already imply it.
- A violated precondition is a bug in the caller. Never catch one, and never
  write a catch-all that would swallow one.
- Throw when a postcondition cannot be met despite correct use.
- Prefer throwing to returning `undefined` when absence is always an error. If
  every caller would turn the `undefined` into the same throw, throw it here.
- `undefined` is for the cases where absence is a real answer, and the type
  should say so: no recorded baseline, no measurable line in a patch.
- Preconditions may be weakened and postconditions strengthened freely. Doing
  the reverse breaks callers, so check every call site first.
- A contract too strict to satisfy without tripping it is the wrong contract.
  Loosen it, or report the error instead.

## Structure

- The logic knows nothing about the Actions toolkit, the GitHub API or the
  filesystem. It talks to `src/ports.ts` and nothing else.
- `src/adapters.ts` is the only file allowed to import `@actions/*`, `fs` or
  the network, and it holds no logic worth testing on its own.
- Pure functions where the work is a calculation: parsing a diff, intersecting
  it with coverage, rendering markdown. They take values and return values.
- A new dependency ships inside `dist/index.js` on every job. Weigh it, prefer
  the standard library, and say in the commit message what it bought.
- Functions stay under about 50 lines. Past that, name the pieces.
- Names are readable words. Abbreviate only where the short form is the name
  everyone uses, such as URL or JSON.

## Tests

- Cover new behaviour at the level that owns it. Pure functions are tested
  directly, against their contract. Logic that coordinates ports is tested
  through `main` with the fakes in `tests/support/fakes.ts`. Adapters are
  covered by the integration job in CI, which runs the built action against a
  real coverage report.
- Test the contract, not the implementation: valid inputs in, promised
  results out. A test that would survive a rewrite of the body is a good test.
- Fakes, not mocks. A fake records what it was asked to do and answers from a
  field a test can set. Asserting on call order couples a test to a shape that
  is free to change.
- Cover the edges the contract names, since they are the ones callers hit:
  the empty patch, the missing baseline, the file absent from the report, the
  percentage that lands exactly on its threshold.
- Every reported bug earns a test that fails before the fix.
- Test names say what is guaranteed, in a sentence: "passes a pull request
  that holds coverage at the baseline".
- Test bodies need no documentation comments. The name and the assertions are
  the documentation.

## Style

- `oxfmt` decides formatting and `oxlint` decides the rest. Run `npm run pack`
  before committing; CI runs the same checks and will not take your word for
  it.
- No em dashes, in code, comments, documentation or commit messages.
- Prose in Markdown wraps at 80 columns.

## The bundle

`dist/index.js` is committed, because GitHub runs it directly without
installing anything. It is generated, so never edit it by hand: change the
sources and run `npm run pack`. CI fails when the committed bundle does not
match the sources it claims to come from.

## Commits and pull requests

- A commit message says what the code does now and why that is worth doing,
  not what you tried on the way there.
- Write for someone holding the diff and the repository, with none of the
  conversation that produced it.
- Lead with the plain-language summary. Code-level detail comes after, if it
  is needed at all.
- A commit leaves the repository working: tests green, bundle current.
