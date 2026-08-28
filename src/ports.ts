// SPDX short identifier: MIT

// The reporter in `coverage-comment.ts` talks to the outside world only
// through these interfaces. `adapters.ts` implements them with the GitHub
// Actions toolkit and node; `tests/support/fakes.ts` implements them in
// memory.

/** What the action was asked to report. */
export interface Options {
  /** Path to the JSON report written by `coverage json`. */
  coverageFile: string;
  /** Patch coverage percentage below which the run fails, or undefined for no gate. */
  minimumPatchCoverage: number | undefined;
  /** Project coverage percentage below which the run fails, or undefined for no gate. */
  minimumProjectCoverage: number | undefined;
  /** True iff added lines that never ran are annotated on the diff. */
  annotateMissingLines: boolean;
  /** True iff the summary is posted as a pull request comment. */
  comment: boolean;
}

/** Where an annotation points, with lines counted from 1. */
export interface Annotation {
  /** Repository-relative path of the annotated file. */
  file: string;
  /** First line of the annotated range. */
  startLine: number;
  /** Last line of the annotated range. */
  endLine: number;
}

/** Action inputs, outputs, logging and annotations (`@actions/core`). */
export interface ActionsCore {
  /** Returns the input `name`, or an empty string when unset. */
  getInput(name: string): string;
  /** Sets the output `name` to `value`. */
  setOutput(name: string, value: string): void;
  /** Marks the action as failed with `message`. */
  setFailed(message: string): void;
  /** Writes an informational log line. */
  info(message: string): void;
  /** Writes a warning, attached to `annotation` when one is given. */
  warning(message: string, annotation?: Annotation): void;
  /** Runs `body` inside a collapsible log group and resolves to its result. */
  group<T>(name: string, body: () => Promise<T>): Promise<T>;
}

/** One file a pull request changes. */
export interface ChangedFile {
  /** Repository-relative path, as GitHub reports it. */
  filename: string;
  /** Unified diff of the change; absent for binary and truncated entries. */
  patch?: string;
}

/** A comment already on a pull request. */
export interface Comment {
  /** GitHub's identifier for the comment. */
  id: number;
  /** The comment's markdown body. */
  body: string;
}

/** The pull request a run belongs to. */
export interface PullRequest {
  /** Resolves to every file the pull request changes. */
  changedFiles(): Promise<ChangedFile[]>;
  /** Resolves to the comments on the pull request. */
  comments(): Promise<Comment[]>;
  /** Adds a comment with `body`. */
  addComment(body: string): Promise<void>;
  /** Replaces the body of the comment `id`. */
  updateComment(id: number, body: string): Promise<void>;
}

/** Reading the checked-out workspace. */
export interface FileSystem {
  /** Resolves to the contents of `path`; rejects when it cannot be read. */
  readFile(path: string): Promise<string>;
}

/** Facts about the run. */
export interface Environment {
  /** The pull request being built, or undefined when the run is not one. */
  pullRequest(): PullRequest | undefined;
}

/** Everything the reporter depends on. */
export interface Ports {
  core: ActionsCore;
  fileSystem: FileSystem;
  environment: Environment;
}
