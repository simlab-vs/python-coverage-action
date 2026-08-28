// SPDX short identifier: MIT

import { parseReport, patchCoverage, PatchCoverage } from "./coverage";
import { COMMENT_MARKER, renderComment } from "./report";
import { ActionsCore, Options, Ports, PullRequest } from "./ports";

/** Name of the output holding the project coverage percentage. */
const OUTPUT_PROJECT_COVERAGE = "projectCoverage";
/** Name of the output holding the patch coverage percentage. */
const OUTPUT_PATCH_COVERAGE = "patchCoverage";

/**
 * Reads the action's inputs.
 *
 * :raises Error: when a threshold is neither blank nor a percentage, since a
 *   typo there would otherwise silently disable the gate it was meant to set.
 */
export function readOptions(core: ActionsCore): Options {
  return {
    coverageFile: core.getInput("coverageFile").trim() || "coverage.json",
    minimumPatchCoverage: readPercentage(core, "minimumPatchCoverage"),
    minimumProjectCoverage: readPercentage(core, "minimumProjectCoverage"),
    annotateMissingLines: readBoolean(core, "annotateMissingLines", true),
    comment: readBoolean(core, "comment", true),
    requireNonDecreasingCoverage: readBoolean(core, "requireNonDecreasingCoverage", false),
  };
}

/**
 * Reports coverage for one run, failing the run rather than the process when
 * anything goes wrong, so a bad input reads as one `::error::` line instead of
 * a stack trace.
 */
export async function main(ports: Ports): Promise<void> {
  try {
    await reportCoverage(ports);
  } catch (error) {
    ports.core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Sets the outputs, comments and annotates on a pull request, and fails the
 * run when either threshold is not met.
 *
 * A pull request that adds no measurable line has no patch coverage to
 * report, and passes the patch gate rather than failing it.
 */
async function reportCoverage(ports: Ports): Promise<void> {
  const { core, fileSystem, environment, baseline } = ports;
  const options = readOptions(core);

  const report = parseReport(await fileSystem.readFile(options.coverageFile));
  core.setOutput(OUTPUT_PROJECT_COVERAGE, report.projectCoverage.toFixed(2));
  core.info(`Project coverage: ${report.projectCoverage.toFixed(2)}%`);

  const pullRequest = environment.pullRequest();

  // The baseline is read on a pull request and written everywhere else, which
  // is what makes the comparison one against the branch being targeted: the
  // Actions cache lets a pull request read what a build of the base branch
  // wrote, and not the other way round.
  let recorded: number | undefined;
  if (options.requireNonDecreasingCoverage) {
    if (pullRequest === undefined) {
      await core.group("Recording the coverage baseline", () =>
        baseline.write(report.projectCoverage),
      );
    } else {
      recorded = await core.group("Reading the coverage baseline", () => baseline.read());
      core.info(
        recorded === undefined
          ? "No baseline recorded yet; coverage cannot be compared against the base branch."
          : `Baseline coverage: ${recorded.toFixed(2)}%`,
      );
    }
  }

  let patch: PatchCoverage = { covered: 0, missingByFile: new Map(), percentage: undefined };
  if (pullRequest !== undefined) {
    const changes = await core.group("Reading the pull request diff", () =>
      pullRequest.changedFiles(),
    );
    patch = patchCoverage(report, changes);
    core.setOutput(
      OUTPUT_PATCH_COVERAGE,
      patch.percentage === undefined ? "" : patch.percentage.toFixed(2),
    );
    core.info(
      patch.percentage === undefined
        ? "This pull request adds no measurable line."
        : `Patch coverage: ${patch.percentage.toFixed(2)}%`,
    );
    if (options.annotateMissingLines) annotate(core, patch);
    if (options.comment) {
      await core.group("Commenting on the pull request", () =>
        upsertComment(
          pullRequest,
          renderComment({ ...options, ...report, patch, baselineCoverage: recorded }),
        ),
      );
    }
  }

  const failures = [
    shortfall("Patch", patch.percentage, options.minimumPatchCoverage),
    shortfall("Project", report.projectCoverage, options.minimumProjectCoverage),
    decrease(report.projectCoverage, recorded),
  ].filter((message) => message !== undefined);
  if (failures.length > 0) core.setFailed(failures.join(" "));
}

/** Warns on every added line that never ran, so it shows up on the diff. */
function annotate(core: ActionsCore, patch: PatchCoverage): void {
  for (const [file, lines] of patch.missingByFile) {
    for (const line of lines) {
      core.warning("This line is not covered by tests.", {
        file,
        startLine: line,
        endLine: line,
      });
    }
  }
}

/**
 * Returns the message for `percentage` falling short of `minimum`, or
 * undefined when it does not: an absent percentage measures nothing and so
 * cannot fall short.
 */
function shortfall(
  what: string,
  percentage: number | undefined,
  minimum: number | undefined,
): string | undefined {
  if (minimum === undefined || percentage === undefined || percentage >= minimum) return undefined;
  return `${what} coverage is ${percentage.toFixed(2)}%, below the required ${minimum}%.`;
}

/**
 * Returns the message for `coverage` having fallen below `recorded`, or
 * undefined when it has not: with no baseline there is nothing to fall below,
 * and matching it exactly is not a decrease.
 */
function decrease(coverage: number, recorded: number | undefined): string | undefined {
  if (recorded === undefined || coverage >= recorded) return undefined;
  return `Project coverage fell from ${recorded.toFixed(2)}% to ${coverage.toFixed(2)}%.`;
}

/** Replaces this action's earlier comment, or adds one when there is none. */
async function upsertComment(pullRequest: PullRequest, body: string): Promise<void> {
  const existing = (await pullRequest.comments()).find((comment) =>
    comment.body.includes(COMMENT_MARKER),
  );
  if (existing === undefined) await pullRequest.addComment(body);
  else await pullRequest.updateComment(existing.id, body);
}

/** Reads a percentage input, or undefined when it is blank. */
function readPercentage(core: ActionsCore, name: string): number | undefined {
  const raw = core.getInput(name).trim();
  if (raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`'${name}' must be a percentage between 0 and 100, but was '${raw}'.`);
  }
  return value;
}

/** Reads a boolean input, falling back to `fallback` when it is blank. */
function readBoolean(core: ActionsCore, name: string, fallback: boolean): boolean {
  const raw = core.getInput(name).trim().toLowerCase();
  if (raw === "") return fallback;
  return raw === "true";
}
