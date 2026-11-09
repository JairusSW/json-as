#!/usr/bin/env bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.
#
# SPDX-License-Identifier: MPL-2.0
# Copyright (c) 2026 Jairus Tanaka

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
