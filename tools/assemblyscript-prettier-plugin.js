// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import pluginEstree from "prettier/plugins/estree";
import pluginTypescript from "prettier/plugins/typescript";
import { magic, preProcess } from "./replacer.js";
import { builders } from "prettier/doc";

const estreePrinter = pluginEstree.printers.estree;

const as_estree = {
  ...estreePrinter,
  printComment(commentPath, options) {
    const comment = commentPath.getValue().value;
    if (comment.startsWith(magic) && comment.endsWith(magic)) {
      const doc = [];
      if (commentPath.stack[commentPath.stack.length - 2] === 0) {
        doc.push(builders.hardline);
      }
      doc.push(comment.slice(magic.length, -magic.length));
      return doc;
    }
    return estreePrinter.printComment(commentPath, options);
  },
};

export default {
  parsers: {
    typescript: {
      ...pluginTypescript.parsers.typescript,
      astFormat: "as-estree",
      preprocess: preProcess,
    },
  },
  printers: { "as-estree": as_estree },
};
