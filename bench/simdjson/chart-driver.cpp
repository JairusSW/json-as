// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

#include "simdjson.h"
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>

static void check(simdjson::error_code error) {
  if (error) throw std::runtime_error(simdjson::error_message(error));
}
template <class T> inline void blackbox(const T &value) {
  asm volatile("" : : "g"(&value) : "memory");
}
template <class F> void measure(const char *kind, size_t ops, size_t bytes, F routine) {
  for (size_t i = 0; i < ops / 10; i++) routine();
  const auto start = std::chrono::steady_clock::now();
  for (size_t i = 0; i < ops; i++) routine();
  const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
  if (!(ms > 0)) throw std::runtime_error("Nonpositive benchmark duration");
  std::cout << "BASELINE {\"kind\":\"" << kind << "\",\"operations\":" << ops
    << ",\"bytes\":" << bytes << ",\"elapsed\":" << std::setprecision(17) << ms
    << ",\"nsPerOp\":" << ms * 1e6 / ops << ",\"mbps\":" << bytes * double(ops) / ms / 1000 << "}\n";
}
int main(int argc, char **argv) {
  try {
    if (argc == 2 && std::string(argv[1]) == "--version") {
      std::cout << "simdjson " << SIMDJSON_VERSION << " native DOM\n"; return 0;
    }
    if (argc != 5) throw std::runtime_error("usage: driver input ops oracle check|measure");
    simdjson::padded_string text; check(simdjson::padded_string::load(argv[1]).get(text));
    const size_t ops = std::stoull(argv[2]);
    if (ops == 0) throw std::runtime_error("Operations must be positive");
    simdjson::dom::parser parser;
    simdjson::dom::element document;
    check(parser.parse(text).get(document));
    std::string output = simdjson::minify(document);
    std::ofstream oracle(argv[3], std::ios::binary); oracle << output; oracle.close();
    if (!oracle) throw std::runtime_error("Cannot write output oracle");
    if (std::string(argv[4]) == "check") return 0;
    std::cout << "IMPLEMENTATION " << simdjson::get_active_implementation()->name() << "\n";
    measure("deserialize", ops, text.size(), [&] {
      check(parser.parse(text).get(document)); blackbox(document);
    });
    measure("serialize", ops, text.size(), [&] {
      std::string next = simdjson::minify(document); blackbox(next); output = std::move(next);
    });
    blackbox(output);
    return 0;
  } catch (const std::exception &error) { std::cerr << error.what() << "\n"; return 1; }
}
