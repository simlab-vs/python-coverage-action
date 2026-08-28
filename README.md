# python-coverage-action

Comments Python coverage on a pull request, marks the lines it added that
never ran, and fails the build when too few of them are covered.

It runs on Node. There is no container to build, so the step starts straight
away instead of pulling and building an image on every job.

```yaml
- run: uv run pytest --cov
- run: uv run coverage json
- uses: simlab-vs/python-coverage-action@v1.0.0
  with:
    minimumPatchCoverage: 85
```

Hand it the JSON that `coverage json` writes. Everything else has a default.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `githubToken` | no | `${{ github.token }}` | Token used to read the diff and write the comment. |
| `coverageFile` | no | `coverage.json` | Path to the JSON report written by `coverage json`. |
| `minimumPatchCoverage` | no | | Fail when less than this percentage of the lines the pull request adds is covered. Blank asks for no gate. |
| `minimumProjectCoverage` | no | | Fail when project coverage is below this percentage. Blank asks for no gate. |
| `annotateMissingLines` | no | `true` | Mark added lines that never ran, so they show up on the diff. |
| `comment` | no | `true` | Post the summary as a pull request comment, editing the previous one. |
| `requireNonDecreasingCoverage` | no | `false` | Fail when a pull request lowers project coverage below what the base branch last recorded. |

## Outputs

| Output | Description |
|--------|-------------|
| `projectCoverage` | Percentage of the project's statements that ran. |
| `patchCoverage` | Percentage of the lines the pull request adds that ran. Empty when it adds none. |

## What counts as covered

Patch coverage looks only at the lines coverage.py measured. Blank lines,
comments and docstrings are neither covered nor missing, so adding them moves
nothing. Files the report never mentions are skipped, which is how tests,
configuration and anything under `omit` stay out of the number.

Plenty of pull requests add no measurable line at all. Those get an empty
`patchCoverage` and pass the gate. Failing a build over a percentage that does
not exist helps nobody.

## Keeping coverage from slipping

Turn on `requireNonDecreasingCoverage` and a pull request that drops project
coverage below its base branch fails.

That needs a baseline, which the action keeps in the Actions cache. Builds
that are not pull requests write it, pull requests read it:

```yaml
on:
  push:
    branches: [main]   # writes the baseline
  pull_request:        # checked against it
```

The cache happens to have exactly the visibility this wants. A pull request
can read what its base branch cached, but nothing it writes is visible to the
base branch or to other pull requests. No data branch to maintain, no extra
permissions to grant.

A first build has no baseline to read, and neither does one whose cache has
been evicted. Both pass, with a line in the log saying so. Landing exactly on
the baseline counts as holding steady rather than slipping.

## Permissions

```yaml
permissions:
  contents: read
  pull-requests: write   # only for the comment
```

Reading the diff needs nothing beyond the default token. Drop
`pull-requests: write` if you set `comment: false`.

## Why it exists

Coverage actions tend to ship as containers, which means the runner builds a
Docker image before the step can even start. On a self-hosted runner with a
throwaway image store there is no layer cache to help, so that base image gets
pulled again on every single job. This action does the few things one project
actually used out of that: a comment, annotations, and a patch coverage gate.

## Credits

The idea comes from
[py-cov-action/python-coverage-comment-action](https://github.com/py-cov-action/python-coverage-comment-action)
by [Joachim Jablon](https://github.com/ewjoachim) and its contributors, which
is what this repository replaced and what taught it what a coverage comment
should say. That action does considerably more: a coverage badge, an HTML
dashboard, stored history. If you want any of that, reach for it instead. No
code was copied here, and both are MIT licensed. Thanks for the original.
