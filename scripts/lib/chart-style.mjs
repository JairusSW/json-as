// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Match overview's typography everywhere; plot type and measurements stay intact.
export const CHART_FONT = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";

export function overviewStyle(config, sidebar) {
  const options = (config.options ??= {});
  const plugins = (options.plugins ??= {});
  options.font = { ...options.font, family: CHART_FONT };
  plugins.title = {
    ...plugins.title,
    font: {
      ...plugins.title?.font,
      family: CHART_FONT,
      size: 20,
      weight: "bold",
    },
  };
  plugins.legend = {
    ...plugins.legend,
    position: "top",
    labels: {
      ...plugins.legend?.labels,
      font: {
        ...plugins.legend?.labels?.font,
        family: CHART_FONT,
        size: 16,
        weight: "bold",
      },
      padding: 20,
    },
  };
  plugins.subtitle = {
    display: true,
    text: sidebar,
    position: "right",
    padding: 16,
    color: "#59636e",
    font: { family: CHART_FONT, size: 14, weight: "bold" },
  };
  if (plugins.datalabels)
    plugins.datalabels.font = {
      ...plugins.datalabels.font,
      family: CHART_FONT,
      weight: "bold",
    };
  for (const axis of Object.values(options.scales ?? {})) {
    axis.title = {
      ...axis.title,
      font: {
        ...axis.title?.font,
        family: CHART_FONT,
        size: 16,
        weight: "bold",
      },
    };
    axis.ticks = {
      ...axis.ticks,
      font: {
        ...axis.ticks?.font,
        family: CHART_FONT,
        size: 14,
        weight: "bold",
      },
    };
  }
  return config;
}

// Keep full provenance in the accompanying metadata, not on the chart canvas.
export function compactSidebar(records, fallback = "json-as") {
  const measured = records.filter(Boolean);
  if (!measured.length) {
    const parts = String(fallback)
      .split(/[\n•]/)
      .map((part) => part.trim());
    const architecture = parts.find((part) =>
      /^(?:arm64|x64|x86_64|aarch64)$/.test(part),
    );
    const version = parts.find((part) => /^v\d/.test(part));
    const runtimes = parts
      .find((part) => /^\d+ runtimes/.test(part))
      ?.split(" · ")[0]
      .replace(/^1 runtimes$/, "1 runtime");
    return architecture || version
      ? [
          parts[0].slice(0, 10),
          version,
          runtimes,
          parts[4],
          parts[5],
          architecture?.toUpperCase(),
        ]
          .filter(Boolean)
          .join(" • ")
      : "json-as";
  }
  const unique = (get, values = measured) => [
    ...new Set(values.map(get).filter(Boolean)),
  ];
  const dates = unique((r) => r.startedAt?.slice(0, 10)).sort();
  const date =
    dates.length === 1
      ? dates[0]
      : dates.length
        ? dates[0].slice(5) + "–" + dates.at(-1).slice(5)
        : null;
  const versions = unique((r) => r.source?.packageVersion);
  const commits = unique((r) => r.source?.commit);
  const branches = unique((r) => r.source?.branch);
  const architectures = unique((r) => r.host?.arch?.toUpperCase());
  const asRecords = measured.filter((r) => r.settings?.language === "as");
  const primary = asRecords.length
    ? asRecords
    : measured.filter((r) => r.settings?.language !== "native");
  const engines = unique((r) => {
    const family =
      r.settings?.runtime === "v8"
        ? "V8"
        : r.settings?.runtime === "node"
          ? "Node"
          : r.settings?.runtime?.toUpperCase();
    const raw =
      family === "V8"
        ? r.tools?.v8
        : family === "Node"
          ? r.tools?.node
          : r.tools?.runtime;
    const version = String(raw ?? "").match(/\d+(?:\.\d+){1,3}/)?.[0];
    return family ? family + (version ? " " + version : "") : null;
  }, primary);
  return [
    date,
    versions.length === 1 ? "v" + versions[0] : "mixed versions",
    engines.length === 1
      ? engines[0]
      : engines.length
        ? "mixed engines"
        : "Native",
    commits.length === 1 ? commits[0].slice(0, 7) : "mixed revs",
    branches.length === 1
      ? branches[0]
      : branches.length
        ? "mixed branches"
        : null,
    architectures.length === 1 ? architectures[0] : "mixed hosts",
  ]
    .filter(Boolean)
    .join(" • ");
}
