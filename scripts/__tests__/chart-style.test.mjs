// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import test from "node:test";
import {
  overviewStyle,
  compactSidebar,
  CHART_FONT,
} from "../lib/chart-style.mjs";

test("all plots retain their body data and callbacks under the overview style", () => {
  const data = { datasets: [{ label: "SIMD", data: [{ x: 1, y: 2 }] }] };
  const format = (value) => String(value);
  const config = {
    type: "line",
    data,
    options: {
      plugins: {
        subtitle: { text: ["long", "footer"], position: "bottom" },
        datalabels: { display: false, formatter: format },
      },
      scales: {
        x: { ticks: { callback: format } },
        y: { type: "logarithmic" },
      },
    },
  };
  const styled = overviewStyle(config, "ARM64 · V8 · v2.0.0");
  assert.strictEqual(styled.data, data);
  assert.strictEqual(styled.options.scales.x.ticks.callback, format);
  assert.strictEqual(styled.options.plugins.datalabels.formatter, format);
  assert.equal(styled.options.scales.y.type, "logarithmic");
  assert.equal(styled.options.plugins.subtitle.position, "right");
  assert.equal(typeof styled.options.plugins.subtitle.text, "string");
  assert.doesNotMatch(styled.options.plugins.subtitle.text, /\n/);
  for (const font of [
    styled.options.plugins.title.font,
    styled.options.plugins.legend.labels.font,
    styled.options.scales.x.ticks.font,
    styled.options.scales.y.title.font,
  ]) {
    assert.equal(font.family, CHART_FONT);
    assert.equal(font.weight, "bold");
  }
});
test("sidebar uses recorded date, revision and engine without confusing native references", () => {
  const record = {
    startedAt: "2026-11-09T12:00:00Z",
    source: { packageVersion: "2.0.0", commit: "abcdef012345", branch: "main" },
    tools: { v8: "V8 version 15.2.20" },
    host: { arch: "arm64" },
    settings: { language: "as", runtime: "v8", strict: "false", fastPath: "1" },
  };
  assert.equal(
    compactSidebar([
      record,
      { ...record, settings: { language: "native", runtime: "native" } },
    ]),
    "2026-11-09 • v2.0.0 • V8 15.2.20 • abcdef0 • main • ARM64",
  );
  assert.equal(compactSidebar([]), "json-as");
  assert.equal(
    compactSidebar(
      [],
      "2026-11-09 • v2.0.0 • arm64 • 6 runtimes · NAIVE • hash",
    ),
    "2026-11-09 • v2.0.0 • 6 runtimes • hash • ARM64",
  );
});
