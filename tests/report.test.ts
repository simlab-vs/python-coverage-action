// SPDX short identifier: MIT

import { describe, expect, test } from "vitest";
import { COMMENT_MARKER, ranges, renderComment } from "../src/report";

describe("ranges", () => {
  test("collapses runs and keeps single lines", () => {
    expect(ranges([1, 2, 3, 7, 9, 10])).toBe("1-3, 7, 9-10");
    expect(ranges([4])).toBe("4");
    expect(ranges([])).toBe("");
  });
});

describe("renderComment", () => {
  const summary = {
    projectCoverage: 91.5,
    patch: {
      covered: 8,
      missingByFile: new Map([["src/a.py", [3, 4, 5]]]),
      percentage: 72.73,
    },
    minimumPatchCoverage: 85,
    minimumProjectCoverage: undefined,
  };

  test("carries the marker that identifies the comment to replace", () => {
    expect(renderComment(summary)).toContain(COMMENT_MARKER);
  });

  test("marks a patch below the requirement and lists its lines", () => {
    const body = renderComment(summary);
    expect(body).toContain("❌ 72.73%");
    expect(body).toContain("✅ 91.50%");
    expect(body).toContain("`src/a.py` | 3-5");
    expect(body).toContain("3 added lines are not covered");
  });

  test("says so when the pull request adds nothing to cover", () => {
    const body = renderComment({
      ...summary,
      patch: { covered: 0, missingByFile: new Map(), percentage: undefined },
    });
    expect(body).toContain("no new lines to cover");
    expect(body).not.toContain("not covered</summary>");
  });

  test("shows a dash where no requirement is set", () => {
    expect(renderComment({ ...summary, minimumPatchCoverage: undefined })).toContain("| – |");
  });
});
