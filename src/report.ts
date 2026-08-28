// SPDX short identifier: MIT

import { PatchCoverage } from "./coverage";

/**
 * Hidden marker identifying this action's comment, so a re-run edits the
 * comment it wrote before instead of adding another.
 */
export const COMMENT_MARKER = "<!-- python-coverage-action -->";

/** Files listed individually before the rest are summarised as a count. */
const MAX_LISTED_FILES = 10;

/** What a run measured. */
export interface Summary {
  /** Percentage of the project's statements that ran. */
  projectCoverage: number;
  /** Coverage of the lines the pull request adds. */
  patch: PatchCoverage;
  /** The patch coverage the run requires, or undefined when it requires none. */
  minimumPatchCoverage: number | undefined;
  /** The project coverage the run requires, or undefined when it requires none. */
  minimumProjectCoverage: number | undefined;
}

/** Renders `summary` as the markdown body of the pull request comment. */
export function renderComment(summary: Summary): string {
  const { patch } = summary;
  const lines = [
    COMMENT_MARKER,
    "### Coverage",
    "",
    "| | Coverage | Required |",
    "| --- | --- | --- |",
    `| Project | ${verdict(summary.projectCoverage, summary.minimumProjectCoverage)} | ${requirement(
      summary.minimumProjectCoverage,
    )} |`,
    `| This pull request | ${
      patch.percentage === undefined
        ? "no new lines to cover"
        : verdict(patch.percentage, summary.minimumPatchCoverage)
    } | ${requirement(summary.minimumPatchCoverage)} |`,
  ];

  const missingFiles = [...patch.missingByFile.entries()];
  if (missingFiles.length > 0) {
    const total = missingFiles.reduce((sum, [, missing]) => sum + missing.length, 0);
    lines.push(
      "",
      `<details><summary>${total} added ${
        total === 1 ? "line is" : "lines are"
      } not covered</summary>`,
      "",
      "| File | Lines |",
      "| --- | --- |",
    );
    for (const [file, missing] of missingFiles.slice(0, MAX_LISTED_FILES)) {
      lines.push(`| \`${file}\` | ${ranges(missing)} |`);
    }
    if (missingFiles.length > MAX_LISTED_FILES) {
      lines.push(`| and ${missingFiles.length - MAX_LISTED_FILES} more file(s) | |`);
    }
    lines.push("", "</details>");
  }
  return lines.join("\n");
}

/** Renders `percentage` with the mark its comparison against `minimum` earns. */
function verdict(percentage: number, minimum: number | undefined): string {
  const mark = minimum !== undefined && percentage < minimum ? "❌" : "✅";
  return `${mark} ${percentage.toFixed(2)}%`;
}

/** Renders `minimum` as a requirement, or a dash when there is none. */
function requirement(minimum: number | undefined): string {
  return minimum === undefined ? "–" : `${minimum}%`;
}

/**
 * Renders `lines` as comma-separated ranges, collapsing runs: `[1, 2, 3, 7]`
 * becomes `1-3, 7`.
 *
 * :precondition: `lines` is sorted in increasing order and has no duplicates.
 */
export function ranges(lines: number[]): string {
  const rendered: string[] = [];
  for (let i = 0; i < lines.length;) {
    let end = i;
    while (end + 1 < lines.length && lines[end + 1] === lines[end] + 1) end += 1;
    rendered.push(end === i ? `${lines[i]}` : `${lines[i]}-${lines[end]}`);
    i = end + 1;
  }
  return rendered.join(", ");
}
