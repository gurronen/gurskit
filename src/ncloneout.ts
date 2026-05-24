#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";

function usage(): never {
  console.error("Usage: ncloneout repo-name [NUMBER]");
  process.exit(2);
}

async function run(command: string[]) {
  const proc = Bun.spawn(command, {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;

  if (code !== 0) {
    process.exit(code);
  }
}

async function output(command: string[]) {
  const proc = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "inherit",
  });
  const text = await new Response(proc.stdout).text();
  const code = await proc.exited;

  if (code !== 0) {
    process.exit(code);
  }

  return text.trim();
}

const [repoName, rawCount = "5"] = process.argv.slice(2);

if (!repoName || process.argv.length > 4) {
  usage();
}

if (!/^[^/\s]+$/.test(repoName)) {
  console.error("repo-name must not include slashes or whitespace");
  process.exit(2);
}

if (!/^[1-9][0-9]*$/.test(rawCount)) {
  console.error("NUMBER must be a positive integer");
  process.exit(2);
}

if (!Bun.which("gh")) {
  console.error("gh is required");
  process.exit(1);
}

const count = Number(rawCount);
const owner = await output(["gh", "api", "user", "--jq", ".login"]);
const repo = `${owner}/${repoName}`;
const targetRoot = `${repoName}-clones`;

await run(["gh", "repo", "create", repoName, "--private"]);
await mkdir(targetRoot, { recursive: true });

for (let i = 1; i <= count; i++) {
  const targetDir = `${targetRoot}/${repoName}-${i}`;

  if (await Bun.file(targetDir).exists()) {
    console.error(`Skipping ${targetDir}: already exists`);
    continue;
  }

  await run(["gh", "repo", "clone", repo, targetDir]);
}
