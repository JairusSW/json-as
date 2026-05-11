#!/usr/bin/env bash
set -euo pipefail

echo "Building transform..."
npm run build:transform

echo "Running formatter..."
npm run format

if ! git diff --quiet -- . ':(exclude)transform/lib'; then
  echo
  echo "Formatting changed files. Review, stage, and commit those changes before committing."
  git --no-pager diff --stat -- . ':(exclude)transform/lib'
  exit 1
fi

echo "Running linter..."
npm run lint
