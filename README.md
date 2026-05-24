# gurskit

Gurr's helper commands, implemented as self-contained Bun-built CLIs.

## Commands

```bash
gsubst [path]
gcloneout org-name/repo-name NUMBER
ncloneout repo-name [NUMBER]
```

`gsubst` scans from the current directory, or from `path` when provided, down for Git repositories and prints paths relative to the current directory:

```text
./repo-dir (branch-name) (#123)
```

The PR suffix is omitted when no GitHub PR exists for the current branch.

`gcloneout` clones `org-name/repo-name` into:

```text
repo-name-clones/repo-name-1
repo-name-clones/repo-name-2
```

`ncloneout` creates a new private empty GitHub repo under your authenticated account, then clones it into five checkouts by default:

```text
repo-name-clones/repo-name-1
repo-name-clones/repo-name-2
```

Pass `NUMBER` to override the default checkout count.

## Setup

```bash
git clone <repo-url>
cd gurskit
bun install
bun run build
bun link
```

After linking, `gsubst`, `gcloneout`, and `ncloneout` are available from your shell.
