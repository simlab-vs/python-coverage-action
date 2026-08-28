// SPDX short identifier: MIT

import { addedLines } from "./diff";
import { ChangedFile } from "./ports";

/** Line-level coverage of one file. */
export interface FileCoverage {
  /** Statement lines that ran. */
  executedLines: Set<number>;
  /** Statement lines that did not run. */
  missingLines: Set<number>;
}

/** A report written by `coverage json`. */
export interface CoverageReport {
  /** Coverage by repository-relative path. */
  files: Map<string, FileCoverage>;
  /** Percentage of the project's statements that ran. */
  projectCoverage: number;
}

/** Coverage of the statement lines a pull request adds. */
export interface PatchCoverage {
  /** Added statement lines that ran. */
  covered: number;
  /** Added statement lines that did not run, by repository-relative path. */
  missingByFile: Map<string, number[]>;
  /** Percentage covered, or undefined when the patch adds no statement line. */
  percentage: number | undefined;
}

/** Rounds `value` to two decimals, the precision reported and compared. */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Parses the JSON `coverage json` writes.
 *
 * :raises Error: when `json` is not that report, naming what was wrong, since
 *   the usual cause is pointing the action at the wrong file.
 */
export function parseReport(json: string): CoverageReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`the coverage report is not valid JSON: ${(error as Error).message}`);
  }
  const report = parsed as {
    files?: Record<string, { executed_lines?: number[]; missing_lines?: number[] }>;
    totals?: { percent_covered?: number };
  };
  if (report.files === undefined || report.totals?.percent_covered === undefined) {
    throw new Error(
      "the coverage report has no 'files' and 'totals.percent_covered'; " +
        "it must be written by `coverage json`",
    );
  }
  const files = new Map<string, FileCoverage>();
  for (const [path, file] of Object.entries(report.files)) {
    files.set(normalize(path), {
      executedLines: new Set(file.executed_lines ?? []),
      missingLines: new Set(file.missing_lines ?? []),
    });
  }
  return { files, projectCoverage: round(report.totals.percent_covered) };
}

/**
 * Returns how much of what `changes` adds was covered by `report`.
 *
 * Only lines coverage.py measured count: an added blank line, comment or
 * docstring is neither covered nor missing, so it neither helps nor hurts the
 * percentage. Files the report does not mention are skipped entirely, which is
 * what excludes tests, configuration and anything under `omit`.
 */
export function patchCoverage(report: CoverageReport, changes: ChangedFile[]): PatchCoverage {
  let covered = 0;
  let missing = 0;
  const missingByFile = new Map<string, number[]>();
  for (const change of changes) {
    const file = report.files.get(normalize(change.filename));
    if (file === undefined || change.patch === undefined) continue;
    const missingHere: number[] = [];
    for (const line of addedLines(change.patch)) {
      if (file.executedLines.has(line)) covered += 1;
      else if (file.missingLines.has(line)) missingHere.push(line);
    }
    missing += missingHere.length;
    if (missingHere.length > 0) missingByFile.set(change.filename, missingHere);
  }
  const measured = covered + missing;
  return {
    covered,
    missingByFile,
    percentage: measured === 0 ? undefined : round((covered / measured) * 100),
  };
}

/** Returns `path` with separators and any leading `./` in GitHub's form. */
function normalize(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
