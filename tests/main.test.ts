// SPDX short identifier: MIT

import { describe, expect, test } from "vitest";
import { main, readOptions } from "../src/coverage-comment";
import { COMMENT_MARKER } from "../src/report";
import { FakeCore, FakePullRequest, Fakes } from "./support/fakes";

/** `src/a.py` line 3 never ran; everything else did. */
const REPORT = JSON.stringify({
  files: { "src/a.py": { executed_lines: [1, 2, 4], missing_lines: [3] } },
  totals: { percent_covered: 75 },
});

/** A patch adding lines 2, 3 and 4 of the file it applies to. */
const PATCH = ["@@ -1,1 +1,4 @@", " one", "+two", "+three", "+four"].join("\n");

/** Fakes holding `REPORT` at the default path, on a pull request. */
function fakesOnPullRequest(): { fakes: Fakes; pull: FakePullRequest } {
  const fakes = new Fakes();
  fakes.fileSystem.files["coverage.json"] = REPORT;
  const pull = new FakePullRequest();
  pull.files = [{ filename: "src/a.py", patch: PATCH }];
  fakes.environment.pull = pull;
  return { fakes, pull };
}

describe("readOptions", () => {
  test("defaults the file, the annotations and the comment", () => {
    expect(readOptions(new FakeCore())).toEqual({
      coverageFile: "coverage.json",
      minimumPatchCoverage: undefined,
      minimumProjectCoverage: undefined,
      annotateMissingLines: true,
      comment: true,
      requireNonDecreasingCoverage: false,
    });
  });

  test.each([
    ["false", false],
    ["FALSE", false],
    ["true", true],
    ["yes", false],
  ])("parses comment=%s as %s", (input, expected) => {
    const core = new FakeCore();
    core.inputs = { comment: input };
    expect(readOptions(core).comment).toBe(expected);
  });

  test("rejects a threshold that is not a percentage", () => {
    const core = new FakeCore();
    core.inputs = { minimumPatchCoverage: "eighty" };
    expect(() => readOptions(core)).toThrow(/must be a percentage/);
    core.inputs = { minimumPatchCoverage: "101" };
    expect(() => readOptions(core)).toThrow(/must be a percentage/);
  });
});

describe("main", () => {
  test("reports both percentages as outputs", async () => {
    const { fakes } = fakesOnPullRequest();
    await main(fakes);

    expect(fakes.core.outputs.projectCoverage).toBe("75.00");
    expect(fakes.core.outputs.patchCoverage).toBe("66.67");
    expect(fakes.core.failures).toEqual([]);
  });

  test("fails when the patch is below the requirement, naming both numbers", async () => {
    const { fakes } = fakesOnPullRequest();
    fakes.core.inputs = { minimumPatchCoverage: "85" };
    await main(fakes);

    expect(fakes.core.failures).toEqual(["Patch coverage is 66.67%, below the required 85%."]);
  });

  test("passes when the patch meets the requirement", async () => {
    const { fakes } = fakesOnPullRequest();
    fakes.core.inputs = { minimumPatchCoverage: "50" };
    await main(fakes);

    expect(fakes.core.failures).toEqual([]);
  });

  test("passes the patch gate when the pull request adds no measurable line", async () => {
    const { fakes, pull } = fakesOnPullRequest();
    pull.files = [
      { filename: "src/a.py", patch: ["@@ -8,1 +8,2 @@", " eight", "+nine"].join("\n") },
    ];
    fakes.core.inputs = { minimumPatchCoverage: "85" };
    await main(fakes);

    expect(fakes.core.failures).toEqual([]);
    expect(fakes.core.outputs.patchCoverage).toBe("");
  });

  test("fails on project coverage independently of the patch", async () => {
    const { fakes } = fakesOnPullRequest();
    fakes.core.inputs = { minimumProjectCoverage: "90" };
    await main(fakes);

    expect(fakes.core.failures).toEqual(["Project coverage is 75.00%, below the required 90%."]);
  });

  test("annotates every added line that never ran", async () => {
    const { fakes } = fakesOnPullRequest();
    await main(fakes);

    expect(fakes.core.warnings).toEqual([
      {
        message: "This line is not covered by tests.",
        annotation: { file: "src/a.py", startLine: 3, endLine: 3 },
      },
    ]);
  });

  test("does not annotate when asked not to", async () => {
    const { fakes } = fakesOnPullRequest();
    fakes.core.inputs = { annotateMissingLines: "false" };
    await main(fakes);

    expect(fakes.core.warnings).toEqual([]);
  });

  test("adds a comment when there is none yet", async () => {
    const { fakes, pull } = fakesOnPullRequest();
    await main(fakes);

    expect(pull.added).toHaveLength(1);
    expect(pull.added[0]).toContain(COMMENT_MARKER);
    expect(pull.updated).toEqual([]);
  });

  test("replaces its own earlier comment rather than adding another", async () => {
    const { fakes, pull } = fakesOnPullRequest();
    pull.existingComments = [
      { id: 1, body: "a review comment" },
      { id: 2, body: `${COMMENT_MARKER}\nan earlier run` },
    ];
    await main(fakes);

    expect(pull.added).toEqual([]);
    expect(pull.updated).toHaveLength(1);
    expect(pull.updated[0].id).toBe(2);
  });

  test("does not comment when asked not to", async () => {
    const { fakes, pull } = fakesOnPullRequest();
    fakes.core.inputs = { comment: "false" };
    await main(fakes);

    expect(pull.added).toEqual([]);
    expect(pull.updated).toEqual([]);
  });

  test("reports only the project outside a pull request", async () => {
    const fakes = new Fakes();
    fakes.fileSystem.files["coverage.json"] = REPORT;
    fakes.core.inputs = { minimumPatchCoverage: "85" };
    await main(fakes);

    expect(fakes.core.outputs.projectCoverage).toBe("75.00");
    expect(fakes.core.outputs.patchCoverage).toBeUndefined();
    expect(fakes.core.failures).toEqual([]);
  });

  test("fails the run, rather than the process, when the report is missing", async () => {
    const fakes = new Fakes();
    await main(fakes);

    expect(fakes.core.failures).toHaveLength(1);
    expect(fakes.core.failures[0]).toMatch(/coverage\.json/);
  });

  test("records the baseline off a pull request, and only when asked to", async () => {
    const fakes = new Fakes();
    fakes.fileSystem.files["coverage.json"] = REPORT;
    await main(fakes);
    expect(fakes.baseline.written).toEqual([]);

    fakes.core.inputs = { requireNonDecreasingCoverage: "true" };
    await main(fakes);
    expect(fakes.baseline.written).toEqual([75]);
  });

  test("fails a pull request that lowers coverage below the baseline", async () => {
    const { fakes } = fakesOnPullRequest();
    fakes.core.inputs = { requireNonDecreasingCoverage: "true" };
    fakes.baseline.recorded = 80;
    await main(fakes);

    expect(fakes.core.failures).toEqual(["Project coverage fell from 80.00% to 75.00%."]);
    expect(fakes.baseline.written).toEqual([]);
  });

  test.each([75, 70])(
    "passes a pull request that holds coverage at or above %s",
    async (recorded) => {
      const { fakes } = fakesOnPullRequest();
      fakes.core.inputs = { requireNonDecreasingCoverage: "true" };
      fakes.baseline.recorded = recorded;
      await main(fakes);

      expect(fakes.core.failures).toEqual([]);
    },
  );

  test("passes when no baseline was ever recorded", async () => {
    const { fakes } = fakesOnPullRequest();
    fakes.core.inputs = { requireNonDecreasingCoverage: "true" };
    await main(fakes);

    expect(fakes.core.failures).toEqual([]);
    expect(fakes.core.infos.join("\n")).toContain("No baseline recorded yet");
  });

  test("leaves the baseline alone when the option is off", async () => {
    const { fakes } = fakesOnPullRequest();
    fakes.baseline.recorded = 90;
    await main(fakes);

    expect(fakes.core.failures).toEqual([]);
  });

  test("reports the change against the baseline in the comment", async () => {
    const { fakes, pull } = fakesOnPullRequest();
    fakes.core.inputs = { requireNonDecreasingCoverage: "true" };
    fakes.baseline.recorded = 70;
    await main(fakes);

    expect(pull.added[0]).toContain("up 5.00 points against the base branch's 70.00%");
  });

  test("fails the run when an input is not a percentage", async () => {
    const fakes = new Fakes();
    fakes.fileSystem.files["coverage.json"] = REPORT;
    fakes.core.inputs = { minimumPatchCoverage: "eighty" };
    await main(fakes);

    expect(fakes.core.failures[0]).toMatch(/must be a percentage/);
  });
});
