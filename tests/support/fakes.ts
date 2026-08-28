// SPDX short identifier: MIT

// In-memory implementations of the ports. A test builds `Fakes`, sets the
// fields it cares about, runs the reporter against it and asserts on what was
// recorded. Nothing touches the network or the filesystem.

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
} from "../../src/ports";

export class FakeCore implements ActionsCore {
  inputs: Record<string, string> = {};
  outputs: Record<string, string> = {};
  failures: string[] = [];
  infos: string[] = [];
  warnings: { message: string; annotation?: Annotation }[] = [];

  getInput(name: string): string {
    return this.inputs[name] ?? "";
  }
  setOutput(name: string, value: string): void {
    this.outputs[name] = value;
  }
  setFailed(message: string): void {
    this.failures.push(message);
  }
  info(message: string): void {
    this.infos.push(message);
  }
  warning(message: string, annotation?: Annotation): void {
    this.warnings.push({ message, annotation });
  }
  group<T>(_name: string, body: () => Promise<T>): Promise<T> {
    return body();
  }
}

export class FakePullRequest implements PullRequest {
  files: ChangedFile[] = [];
  existingComments: Comment[] = [];
  added: string[] = [];
  updated: { id: number; body: string }[] = [];

  changedFiles(): Promise<ChangedFile[]> {
    return Promise.resolve(this.files);
  }
  comments(): Promise<Comment[]> {
    return Promise.resolve(this.existingComments);
  }
  addComment(body: string): Promise<void> {
    this.added.push(body);
    return Promise.resolve();
  }
  updateComment(id: number, body: string): Promise<void> {
    this.updated.push({ id, body });
    return Promise.resolve();
  }
}

export class FakeFileSystem implements FileSystem {
  /** Contents by path; a path that is absent rejects, as a missing file does. */
  files: Record<string, string> = {};

  readFile(path: string): Promise<string> {
    const contents = this.files[path];
    if (contents === undefined) {
      return Promise.reject(new Error(`ENOENT: no such file or directory, open '${path}'`));
    }
    return Promise.resolve(contents);
  }
}

export class FakeBaselineStore implements BaselineStore {
  /** What `read` answers: a percentage, or undefined when none was recorded. */
  recorded: number | undefined = undefined;
  written: number[] = [];

  read(): Promise<number | undefined> {
    return Promise.resolve(this.recorded);
  }
  write(coverage: number): Promise<void> {
    this.written.push(coverage);
    return Promise.resolve();
  }
}

export class FakeEnvironment implements Environment {
  /** The pull request to report on, or undefined for a push build. */
  pull: PullRequest | undefined = undefined;

  pullRequest(): PullRequest | undefined {
    return this.pull;
  }
}

/** All the ports, fake, wired together. */
export class Fakes implements Ports {
  core = new FakeCore();
  fileSystem = new FakeFileSystem();
  environment = new FakeEnvironment();
  baseline = new FakeBaselineStore();
}
