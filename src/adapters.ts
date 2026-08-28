// SPDX short identifier: MIT

// The ports implemented against the real world: the Actions toolkit, the
// GitHub API and the filesystem.

import * as core from "@actions/core";
import * as github from "@actions/github";
import { readFile } from "fs/promises";
import {
  ActionsCore,
  Annotation,
  ChangedFile,
  Comment,
  Environment,
  FileSystem,
  Ports,
  PullRequest,
} from "./ports";

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
  };
}
