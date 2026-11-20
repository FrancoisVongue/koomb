#!/usr/bin/env bash
# Stop hook: before Claude finishes, type-check, lint and test if the working tree changed.
# Exit 2 + stderr blocks the stop and shows Claude the errors, so it has to fix them.
set -u
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Claude is already continuing because of this hook: don't loop forever.
if [ "$(jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

# Nothing changed: nothing to verify.
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

if ! { npm run typecheck --if-present && npm run lint --if-present && npm test --if-present; } 1>&2; then
  echo "Verification failed: fix the errors above before finishing." >&2
  exit 2
fi
