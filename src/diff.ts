// SPDX short identifier: MIT

/** Start of a unified diff hunk, capturing where the new file resumes. */
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Returns the lines `patch` adds, numbered as in the file after the change,
 * in increasing order.
 *
 * `patch` is one file's unified diff as GitHub reports it: hunk headers and
 * body lines, with no `---`/`+++` preamble. Text outside a hunk is ignored, so
 * an empty or truncated patch yields no lines rather than an error.
 */
export function addedLines(patch: string): number[] {
  const added: number[] = [];
  let line = 0;
  for (const text of patch.split("\n")) {
    const header = HUNK_HEADER.exec(text);
    if (header) {
      line = Number(header[1]);
      continue;
    }
    if (line === 0) continue; // preamble, before the first hunk
    if (text.startsWith("+")) {
      added.push(line);
      line += 1;
    } else if (text.startsWith("-") || text.startsWith("\\")) {
      // A removed line is absent from the new file, and `\ No newline at end
      // of file` annotates the line before it; neither advances the count.
    } else {
      line += 1; // context
    }
  }
  return added;
}
