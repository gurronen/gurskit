# gurskit

Gurr's helper commands, implemented as self-contained Bun-built CLIs.

## Commands

```bash
gsubst
gcloneout org-name/repo-name NUMBER
```

`gsubst` scans from the current directory down for Git repositories and prints:

```text
./repo-dir (branch-name) (#123)
```

The PR suffix is omitted when no GitHub PR exists for the current branch.

`gcloneout` clones `org-name/repo-name` into:

```text
repo-name-clones/repo-name-1
repo-name-clones/repo-name-2
```

## Develop

```bash
bun install
bun run check
bun run build
bun link
```
