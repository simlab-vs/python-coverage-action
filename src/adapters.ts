// SPDX short identifier: MIT

// The ports implemented against the real world: the Actions toolkit, the
// GitHub API and the filesystem.

import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { mkdir, readFile, writeFile } from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  ActionsCore,
  Annotation,
  BaselineStore,
  ChangedFile,
  Comment,
  Environment,
  FileSystem,
  Ports,
  PullRequest,
} from "./ports";

/** Prefix shared by every baseline cache entry. */
const BASELINE_KEY_PREFIX = "python-coverage-action-baseline-";

/** `@actions/core`, which already matches the port apart from annotations. */
class ToolkitCore implements ActionsCore {
  getInput = core.getInput;
  setOutput = core.setOutput;
  setFailed = core.setFailed;
  info = core.info;
  group = core.group;

  warning(message: string, annotation?: Annotation): void {
    core.warning(message, annotation);
  }
}

/** One pull request, reached through the REST API. */
class ApiPullRequest implements PullRequest {
  public constructor(
    private readonly api: ReturnType<typeof github.getOctokit>,
    private readonly repository: { owner: string; repo: string },
    private readonly number: number,
  ) {}

  public async changedFiles(): Promise<ChangedFile[]> {
    // Paginated: a large pull request lists far more than one page of files,
    // and a missing page would read as untouched, uncovered code.
    return this.api.paginate(this.api.rest.pulls.listFiles, {
      ...this.repository,
      pull_number: this.number,
      per_page: 100,
    });
  }

  public async comments(): Promise<Comment[]> {
    const comments = await this.api.paginate(this.api.rest.issues.listComments, {
      ...this.repository,
      issue_number: this.number,
      per_page: 100,
    });
    return comments.map((comment) => ({ id: comment.id, body: comment.body ?? "" }));
  }

  public async addComment(body: string): Promise<void> {
    await this.api.rest.issues.createComment({
      ...this.repository,
      issue_number: this.number,
      body,
    });
  }

  public async updateComment(id: number, body: string): Promise<void> {
    await this.api.rest.issues.updateComment({ ...this.repository, comment_id: id, body });
  }
}

/** The run's context, as the Actions toolkit reports it. */
class ActionsEnvironment implements Environment {
  public constructor(private readonly token: string) {}

  public pullRequest(): PullRequest | undefined {
    const number = github.context.payload.pull_request?.number;
    if (number === undefined) return undefined;
    return new ApiPullRequest(github.getOctokit(this.token), github.context.repo, number);
  }
}

/**
 * The baseline, held in the GitHub Actions cache.
 *
 * A cache entry is immutable, so each run writes its own key and reads back
 * the newest entry sharing the prefix. That also gives the comparison its
 * direction: a pull request can restore what a build of the base branch wrote,
 * while what a pull request writes stays invisible to the base branch and to
 * every other pull request.
 */
class CachedBaseline implements BaselineStore {
  private readonly file = path.join(
    process.env.RUNNER_TEMP ?? os.tmpdir(),
    "python-coverage-action",
    "baseline.json",
  );

  public async read(): Promise<number | undefined> {
    // A cache service that is unreachable reads as no baseline rather than as
    // a failure: coverage is what this action gates on, and a run should not
    // fail for want of somewhere to have kept a number.
    const hit = await cache
      .restoreCache([this.file], `${BASELINE_KEY_PREFIX}none`, [BASELINE_KEY_PREFIX])
      .catch(() => undefined);
    if (hit === undefined) return undefined;
    const recorded = (JSON.parse(await readFile(this.file, "utf8")) as { coverage?: number })
      .coverage;
    return typeof recorded === "number" ? recorded : undefined;
  }

  public async write(coverage: number): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify({ coverage }), "utf8");
    const key = `${BASELINE_KEY_PREFIX}${process.env.GITHUB_SHA ?? Date.now()}`;
    // A key written by an earlier run of the same commit is a benign
    // conflict: the baseline it holds is the one this run would have written.
    await cache.saveCache([this.file], key).catch(() => undefined);
  }
}

/** The workspace on disk. */
class NodeFileSystem implements FileSystem {
  public async readFile(path: string): Promise<string> {
    return readFile(path, "utf8");
  }
}

/** The ports the action runs against. */
export function defaultPorts(): Ports {
  const toolkitCore = new ToolkitCore();
  return {
    core: toolkitCore,
    fileSystem: new NodeFileSystem(),
    environment: new ActionsEnvironment(toolkitCore.getInput("githubToken")),
    baseline: new CachedBaseline(),
  };
}
