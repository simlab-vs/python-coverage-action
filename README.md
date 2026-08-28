# python-coverage-action

GitHub Action that reports Python coverage on a pull request and fails the run
when the lines it adds are not covered enough.

It runs on Node, with no container to build: the action starts in well under a
second rather than pulling and building a Docker image on every job.

```yaml
- run: uv run pytest --cov
- run: uv run coverage json
- uses: simlab-vs/python-coverage-action@v1.0.0
  with:
    minimumPatchCoverage: 85
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `githubToken` | no | `${{ github.token }}` | Token used to read the diff and write the comment. |
| `coverageFile` | no | `coverage.json` | Path to the JSON report written by `coverage json`. |
| `minimumPatchCoverage` | no | | Fail when less than this percentage of the lines the pull request adds is covered. Blank asks for no gate. |
| `minimumProjectCoverage` | no | | Fail when project coverage is below this percentage. Blank asks for no gate. |
| `annotateMissingLines` | no | `true` | Annotate added lines that never ran, so they show up on the diff. |
| `comment` | no | `true` | Post the summary as a pull request comment, editing the previous one. |
| `requireNonDecreasingCoverage` | no | `false` | Fail when a pull request lowers project coverage below what the base branch last recorded. |

## Outputs

| Output | Description |
|--------|-------------|
| `projectCoverage` | Percentage of the project's statements that ran. |
| `patchCoverage` | Percentage of the lines the pull request adds that ran; empty when it adds none. |

## What it does

1. Reads the report `coverage json` wrote.
2. On a pull request, asks the API which lines the pull request adds, and
   intersects them with the lines coverage measured.
3. Posts a comment with both percentages, editing its own previous comment
   rather than adding a new one on every push, and annotates the added lines
   that never ran.
4. Fails the run when either percentage is below its requirement.

## Requiring coverage not to fall

`requireNonDecreasingCoverage` compares a pull request against the branch it
targets. There is no baseline to compare against until one has been recorded,
so the action records it on every build that is not a pull request, and reads
it on the ones that are:

```yaml
on:
  push:
    branches: [main]     # records the baseline
  pull_request:          # compared against it

# ...
- uses: simlab-vs/python-coverage-action@v1.0.0
  with:
    requireNonDecreasingCoverage: true
```

The baseline lives in the GitHub Actions cache, which gives the comparison its
direction for free: a pull request can read what a build of the base branch
wrote, while what a pull request writes is visible to nothing else. No branch
is created and no extra permission is needed.

A run with no baseline to read passes and says so, which is what a first build
and an evicted cache both look like. Matching the baseline exactly is not a
decrease.

Only lines coverage.py measured count towards patch coverage. An added blank
line, comment or docstring is neither covered nor missing, and a file the
report does not mention — tests, configuration, anything under `omit` — is
skipped entirely. A pull request that adds no measurable line has no patch
coverage to report: the output is empty and the gate passes rather than
failing on a number that does not exist.

## Permissions

```yaml
permissions:
  contents: read
  pull-requests: write   # only needed for the comment
```

Reading the diff needs no more than the default token. Drop
`pull-requests: write` if you set `comment: false`.

## Why this exists

The alternatives are container actions: the runner builds a Docker image on
every job before the step can start, which on a self-hosted runner with a
disposable image store means pulling the base image every time. This action
does what one project needed from that — a comment, annotations and a patch
coverage gate — and nothing else.

## Acknowledgements

The idea, and the shape of what a good coverage comment says, come from
[py-cov-action/python-coverage-comment-action](https://github.com/py-cov-action/python-coverage-comment-action)
by [Joachim Jablon](https://github.com/ewjoachim) and its contributors. That
action does considerably more than this one — a coverage badge, an HTML
dashboard, a stored history — and is the better choice for most projects.
This is a deliberately smaller reimplementation for a self-hosted runner where
building its container on every job was the dominant cost. No code was taken
from it; both are MIT licensed. Thank you for the original.
