// SPDX short identifier: MIT

import { describe, expect, test } from "vitest";
import { addedLines } from "../src/diff";

describe("addedLines", () => {
  test("numbers added lines as in the file after the change", () => {
    const patch = ["@@ -1,3 +1,5 @@", " one", "+two", "+three", " four", " five"].join("\n");
    expect(addedLines(patch)).toEqual([2, 3]);
  });

  test("does not count a removed line towards the new file", () => {
    const patch = ["@@ -1,4 +1,3 @@", " one", "-gone", "-also gone", "+kept", " last"].join("\n");
    expect(addedLines(patch)).toEqual([2]);
  });

  test("resumes at each hunk header", () => {
    const patch = [
      "@@ -1,2 +1,2 @@",
      " one",
      "+two",
      "@@ -50,2 +60,2 @@",
      " context",
      "+added",
    ].join("\n");
    expect(addedLines(patch)).toEqual([2, 61]);
  });

  test("reads a hunk header without a line count", () => {
    expect(addedLines(["@@ -0,0 +1 @@", "+only"].join("\n"))).toEqual([1]);
  });

  test("ignores the no-newline marker", () => {
    const patch = ["@@ -1,1 +1,2 @@", " one", "+two", "\\ No newline at end of file"].join("\n");
    expect(addedLines(patch)).toEqual([2]);
  });

  test("yields nothing for a patch with no hunk", () => {
    expect(addedLines("")).toEqual([]);
    expect(addedLines("Binary files a/x.png and b/x.png differ")).toEqual([]);
  });
});
