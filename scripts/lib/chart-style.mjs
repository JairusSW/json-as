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
  const labelCase = (value) =>
    Array.isArray(value)
      ? value.map(labelCase)
      : typeof value === "string"
        ? value.replace(/\bV8\b/g, "v8")
        : value;
  if (config.data?.labels)
    config.data.labels = config.data.labels.map(labelCase);
  for (const dataset of config.data?.datasets ?? [])
    dataset.label = labelCase(dataset.label);
  if (plugins.title) plugins.title.text = labelCase(plugins.title.text);
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
export function hardwareModel(host) {
  const model = host?.cpu || host?.model;
  if (!model) return "unknown model";
  const apple = model.trim().match(/^Apple\s+(M\d+)(?:\s+(Max|Pro|Ultra))?$/i);
  if (apple)
    return (
      "Apple " +
      apple[1].toUpperCase() +
      (apple[2] ? " " + apple[2].toUpperCase() : "")
    );
  return model
    .replace(/\(R\)|\(TM\)|[®™]/gi, "")
    .replace(/^Apple\s+/i, "")
    .replace(/\s+\d+-Core Processor$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function compactSidebar(records, fallback = "json-as") {
  const measured = records.filter(Boolean);
  if (!measured.length) {
    const parts = String(fallback)
      .split(/[\n•]/)
      .map((part) => part.trim());
    const model = parts[6] ? hardwareModel({ cpu: parts[6] }) : "unknown model";
    const version = parts.find((part) => /^v\d/.test(part));
    const runtimes = parts
      .find((part) => /^\d+ runtimes/.test(part))
      ?.split(" · ")[0]
      .replace(/^1 runtimes$/, "1 runtime");
    return version
      ? [parts[0].slice(0, 10), version, runtimes, parts[5], model]
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
  const branches = unique((r) => r.source?.branch);
  const models = unique((r) => hardwareModel(r.host));
  const asRecords = measured.filter((r) => r.settings?.language === "as");
  const primary = asRecords.length
    ? asRecords
    : measured.filter((r) => r.settings?.language !== "native");
  const engines = unique((r) => {
    const family =
      r.settings?.runtime === "v8"
        ? "v8"
        : r.settings?.runtime === "node"
          ? "Node"
          : r.settings?.runtime?.toUpperCase();
    const raw =
      family === "v8"
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
    branches.length === 1
      ? branches[0]
      : branches.length
        ? "mixed branches"
        : null,
    models.length === 1 ? models[0] : "mixed models",
  ]
    .filter(Boolean)
    .join(" • ");
}

/** Deserialization uses linear numeric axes, including horizontal bar charts. */
export function linearDeserializationScale(config) {
  const options = (config.options ??= {});
  const scales = (options.scales ??= {});
  const measured = options.indexAxis === "y" ? "x" : "y";
  scales[measured] ??= {};
  for (const [key, axis] of Object.entries(scales)) {
    const wasLogarithmic = axis.type === "logarithmic";
    if (key !== measured && !wasLogarithmic) continue;
    axis.type = "linear";
    axis.beginAtZero = true;
    if (typeof axis.title?.text === "string")
      axis.title.text = axis.title.text.replace(
        /\s*·\s*log(?:2|10) scale/gi,
        "",
      );
    if (wasLogarithmic) {
      if (axis.ticks) delete axis.ticks.callback;
      delete axis.min;
      delete axis.max;
      delete axis.suggestedMin;
      delete axis.suggestedMax;
    }
  }
  return config;
}
