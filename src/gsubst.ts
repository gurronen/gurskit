#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

type Repo = {
  dir: string;
  relativeDir: string;
};

const root = process.cwd();
const maxGitHubConcurrency = 8;
const defaultBranches = new Set(["main", "master"]);

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
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

async function read(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function gitDir(repo: Repo): Promise<string> {
  const dotGit = join(repo.dir, ".git");
  const info = await read(dotGit);
  if (info.startsWith("gitdir:")) return resolve(repo.dir, info.slice("gitdir:".length).trim());
  return dotGit;
}

async function branchName(repo: Repo): Promise<string> {
  const head = (await read(join(await gitDir(repo), "HEAD"))).trim();
  return head.startsWith("ref: refs/heads/") ? head.slice("ref: refs/heads/".length) : head.slice(0, 7) || "unknown";
}

async function originUrl(repo: Repo): Promise<string> {
  const config = await read(join(await gitDir(repo), "config"));
  const lines = config.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\[remote "origin"\]/.test(lines[i])) continue;

    for (let j = i + 1; j < lines.length && !/^\s*\[/.test(lines[j]); j++) {
      const match = lines[j].match(/^\s*url\s*=\s*(.+?)\s*$/);
      if (match) return match[1];
    }
  }

  return "";
}

function githubRepo(remoteUrl: string): string | undefined {
  const trimmed = remoteUrl.trim().replace(/\.git$/, "");
  const match =
    trimmed.match(/^git@github\.com:([^/]+\/[^/]+)$/) ??
    trimmed.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)$/) ??
    trimmed.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/]+)$/);

  return match?.[1];
}

async function githubClient() {
  const { Octokit } = await import("@octokit/rest");
  const auth = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || githubCliHostsToken();
  return new Octokit({
    ...(auth ? { auth } : {}),
    log: { debug() {}, info() {}, warn() {}, error() {} },
  });
}

function githubCliHostsToken(): string {
  const home = process.env.HOME;
  if (!home) return "";

  try {
    const text = readFileSync(join(home, ".config", "gh", "hosts.yml"), "utf8");
    return text.match(/^\s*oauth_token:\s*(.+?)\s*$/m)?.[1] ?? "";
  } catch {
    return "";
  }
}

async function prNumber(repo: Repo, branch: string): Promise<string> {
  if (defaultBranches.has(branch)) return "";

  const remote = await originUrl(repo);
  const repoName = githubRepo(remote);
  if (!repoName) return "";

  const [owner, name] = repoName.split("/");

  try {
    const octokit = await githubClient();
    const { data } = await octokit.pulls.list({
      owner,
      repo: name,
      state: "open",
      head: `${owner}:${branch}`,
      per_page: 1,
    });
    return data[0]?.number ? String(data[0].number) : "";
  } catch {
    return "";
  }
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
  const branch = await branchName(repo);
  const pr = await prNumber(repo, branch);
  return `${repo.relativeDir} (${branch})${pr ? ` (#${pr})` : ""}`;
});

for (const line of lines) {
  console.log(line);
}
