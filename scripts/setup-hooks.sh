#!/usr/bin/env bash
# One-time (idempotent) setup: point git at the repo-tracked hooks in
# .githooks/ and make sure they're executable. Run after cloning, or
# whenever a hook file's permissions get lost (e.g. after a fresh checkout).
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
hooks_dir="$repo_root/.githooks"

git config core.hooksPath .githooks

for hook in "$hooks_dir"/*; do
  [ -f "$hook" ] && chmod +x "$hook"
done

echo "git hooks installed: core.hooksPath = .githooks"
