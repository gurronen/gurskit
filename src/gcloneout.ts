#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";

function usage(): never {
  console.error("Usage: gcloneout org-name/repo-name NUMBER");
  process.exit(2);
}

const [repo, rawCount] = process.argv.slice(2);

if (!repo || !rawCount || process.argv.length !== 4) {
  usage();
}

if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
  usage();
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
const repoName = repo.split("/").at(-1)!;
const targetRoot = `${repoName}-clones`;

await mkdir(targetRoot, { recursive: true });

for (let i = 1; i <= count; i++) {
  const targetDir = `${targetRoot}/${repoName}-${i}`;

  if (await Bun.file(targetDir).exists()) {
    console.error(`Skipping ${targetDir}: already exists`);
    continue;
  }

  const proc = Bun.spawn(["gh", "repo", "clone", repo, targetDir], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;

  if (code !== 0) {
    process.exit(code);
  }
}
