// SPDX short identifier: MIT

import { describe, expect, test } from "vitest";
import { parseReport, patchCoverage } from "../src/coverage";

/** A report covering `src/a.py`, where line 3 never ran. */
const REPORT = JSON.stringify({
  files: {
    "src/a.py": { executed_lines: [1, 2, 4], missing_lines: [3] },
    "src/b.py": { executed_lines: [1], missing_lines: [] },
  },
  totals: { percent_covered: 83.333 },
});

describe("parseReport", () => {
  test("reads the files and rounds the project percentage", () => {
    const report = parseReport(REPORT);
    expect(report.projectCoverage).toBe(83.33);
    expect([...report.files.keys()]).toEqual(["src/a.py", "src/b.py"]);
    expect(report.files.get("src/a.py")?.missingLines.has(3)).toBe(true);
  });

  test("strips a leading ./ so paths match the ones GitHub reports", () => {
    const report = parseReport(
      JSON.stringify({
        files: { "./src/a.py": { executed_lines: [1], missing_lines: [] } },
        totals: { percent_covered: 100 },
      }),
    );
    expect([...report.files.keys()]).toEqual(["src/a.py"]);
  });

  test("rejects anything that is not a coverage report", () => {
    expect(() => parseReport("{")).toThrow(/not valid JSON/);
    expect(() => parseReport("{}")).toThrow(/coverage json/);
    expect(() => parseReport(JSON.stringify({ files: {} }))).toThrow(/coverage json/);
  });
});

describe("patchCoverage", () => {
  const report = parseReport(REPORT);

  test("counts only the added lines coverage measured", () => {
    // Adds lines 2, 3 and 4 of src/a.py: 2 and 4 ran, 3 did not.
    const patch = ["@@ -1,1 +1,4 @@", " one", "+two", "+three", "+four"].join("\n");
    const result = patchCoverage(report, [{ filename: "src/a.py", patch }]);

    expect(result.covered).toBe(2);
    expect(result.missingByFile.get("src/a.py")).toEqual([3]);
    expect(result.percentage).toBe(66.67);
  });

  test("reports no percentage when the patch adds no measurable line", () => {
    // Line 9 is neither executed nor missing: a blank line or a comment.
    const patch = ["@@ -8,1 +8,2 @@", " eight", "+nine"].join("\n");
    const result = patchCoverage(report, [{ filename: "src/a.py", patch }]);

    expect(result.percentage).toBeUndefined();
    expect(result.missingByFile.size).toBe(0);
  });

  test("skips files the report does not mention", () => {
    const patch = ["@@ -0,0 +1,1 @@", "+anything"].join("\n");
    const result = patchCoverage(report, [{ filename: "tests/test_a.py", patch }]);

    expect(result.percentage).toBeUndefined();
  });

  test("skips an entry with no patch, as a binary file has none", () => {
    expect(patchCoverage(report, [{ filename: "src/a.py" }]).percentage).toBeUndefined();
  });

  test("is 100% when every added line ran", () => {
    const patch = ["@@ -1,1 +1,2 @@", " one", "+two"].join("\n");
    expect(patchCoverage(report, [{ filename: "src/a.py", patch }]).percentage).toBe(100);
  });
});
