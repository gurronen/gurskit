#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

type Repo = {
  dir: string;
  relativeDir: string;
};

const root = process.cwd();
const maxGitHubConcurrency = 8;

async function exists(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

async function findRepos(dir: string, repos: Repo[] = []): Promise<Repo[]> {
  if (await exists(join(dir, ".git"))) {
    repos.push({ dir, relativeDir: `./${relative(root, dir) || "."}` });
    return repos;
  }

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return repos;
  }

  entries.sort((a, b) => b.name.localeCompare(a.name));

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    await findRepos(join(dir, entry.name), repos);
  }

  return repos;
}

async function run(command: string[], cwd: string): Promise<string> {
  const proc = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "ignore" });
  const output = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return code === 0 ? output.trim() : "";
}

async function branchName(repo: Repo): Promise<string> {
  return (
    (await run(["git", "branch", "--show-current"], repo.dir)) ||
    (await run(["git", "rev-parse", "--short", "HEAD"], repo.dir)) ||
    "unknown"
  );
}

async function prNumber(repo: Repo): Promise<string> {
  if (!Bun.which("gh")) return "";
  return run(["gh", "pr", "view", "--json", "number", "--jq", ".number"], repo.dir);
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const repos = await findRepos(root);
const lines = await mapLimited(repos, maxGitHubConcurrency, async (repo) => {
  const [branch, pr] = await Promise.all([branchName(repo), prNumber(repo)]);
  return `${repo.relativeDir} (${branch})${pr ? ` (#${pr})` : ""}`;
});

for (const line of lines) {
  console.log(line);
}
