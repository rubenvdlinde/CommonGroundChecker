#!/bin/sh
# Scans the component list on this machine and publishes the results to the
# static site, so the GitHub workflow only rebuilds the pages and spends no
# API calls or runner time on scanning.
#
#   scripts/scan-local-and-publish.sh [scan:static options]
#
# Examples:
#   scripts/scan-local-and-publish.sh                          every component
#   scripts/scan-local-and-publish.sh --only https://github.com/opf/openproject
#   scripts/scan-local-and-publish.sh --full                   ignore reuse
#
# Needs docker, git and an authenticated gh. Run it from a clone of the
# checker; it fetches the data branch into ./data, scans in a container with
# the pinned analysis tools, commits and pushes the data branch, then starts
# the static site workflow with index_only, which builds and deploys the site.
set -eu
cd "$(dirname "$0")/.."

IMAGE=cgc-scanner:local
REPO=$(git remote get-url origin | sed -E 's#^(https://github.com/|git@github.com:)##; s#\.git$##')
BRANCH=$(gh api "repos/$REPO" --jq .default_branch)

DOCKER_CONFIG=$(mktemp -d) docker build -q -t "$IMAGE" -f scripts/scanner.Dockerfile scripts >/dev/null

if [ ! -d data/.git ] && [ ! -f data/.git ]; then
  git fetch -q origin data
  git worktree add -q data FETCH_HEAD
  git -C data switch -q -c data
else
  git -C data fetch -q origin data
  git -C data reset -q --hard FETCH_HEAD
fi

set -- --data data "$@"
if [ -f config/scoring.json ]; then set -- "$@" --scoring config/scoring.json; fi

GITHUB_TOKEN=$(gh auth token) docker run --rm \
  -u "$(id -u):$(id -g)" -e HOME=/tmp -e GITHUB_TOKEN \
  -v "$PWD:/work" -w /work "$IMAGE" \
  sh -c 'npm ci --no-audit --no-fund --silent && npm run --silent scan:static -- "$@"' scan "$@"

cd data
git add -A
if git diff --cached --quiet; then
  echo "No data changes; nothing to publish."
  exit 0
fi
git commit -q -m "chore(data): local scan of $(date -u +%Y-%m-%d)"
git push -q origin HEAD:data
cd ..

gh workflow run static-site.yml -R "$REPO" --ref "$BRANCH" -f index_only=true
echo "Pushed the data branch and started the site build on $REPO ($BRANCH)."
