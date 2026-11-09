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
      ? [architecture?.toUpperCase(), runtimes, version]
          .filter(Boolean)
          .join(" · ")
      : "json-as";
  }
  const unique = (get) => [...new Set(measured.map(get).filter(Boolean))];
  const architectures = unique((r) => r.host?.arch?.toUpperCase());
  const versions = unique((r) => r.source?.packageVersion);
  const runtimes = unique((r) =>
    r.settings?.language === "native"
      ? null
      : r.settings?.runtime === "v8"
        ? "V8"
        : r.settings?.runtime === "node"
          ? "Node"
          : r.settings?.runtime?.toUpperCase(),
  );
  return [
    architectures.length === 1 ? architectures[0] : "Mixed hosts",
    runtimes.length === 1
      ? runtimes[0]
      : runtimes.length
        ? "Multiple runtimes"
        : "Native",
    versions.length === 1 ? "v" + versions[0] : "Multiple versions",
  ].join(" · ");
}
