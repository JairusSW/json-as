// Included after the generated owning model. Never builds a DOM result.
#include <algorithm>
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
      std::cout << "simdjson " << SIMDJSON_VERSION << " native typed value\n"; return 0;
    }
    if (argc != 5) throw std::runtime_error("usage: driver input ops oracle check|measure");
    simdjson::padded_string text; check(simdjson::padded_string::load(argv[1]).get(text));
    const size_t ops = std::stoull(argv[2]);
    if (ops == 0) throw std::runtime_error("Operations must be positive");
    simdjson::ondemand::parser parser;
    const auto parse = [&](const simdjson::padded_string &input, model::Root &out) {
      simdjson::ondemand::document document;
      check(parser.iterate(input).get(document));
      check(document.get(out));
      // The key-selector reader can leave the root closing delimiter pending.
      // Finish consumption through the public API before checking trailing data.
      if (!document.at_end()) {
        std::string_view remaining;
        check(document.raw_json().get(remaining));
      }
      if (!document.at_end()) throw std::runtime_error("Trailing input");
    };
    model::Root value{};
    // Prove the oracle is backed by owned fields, not input/parser views.
    {
      simdjson::padded_string temporary(std::string(text.data(), text.size()));
      parse(temporary, value);
      std::fill(temporary.data(), temporary.data() + temporary.size(), 'x');
    }
    {
      // Reuse the unescape buffer with different contents as well as a
      // different input allocation, so parser-owned string views cannot pass.
      std::string replacement = "\"\\n";
      replacement.append(text.size(), 'B');
      replacement += '\"';
      simdjson::padded_string scratchText(replacement);
      simdjson::ondemand::document scratchDocument;
      check(parser.iterate(scratchText).get(scratchDocument));
      std::string scratchValue;
      check(scratchDocument.get(scratchValue));
      blackbox(scratchValue);
    }
    std::string output;
    check(model::to_owned_json(value, output));
    std::ofstream oracle(argv[3], std::ios::binary); oracle << output; oracle.close();
    if (!oracle) throw std::runtime_error("Cannot write output oracle");
    if (std::string(argv[4]) == "check") return 0;
    std::cout << "IMPLEMENTATION " << simdjson::get_active_implementation()->name() << "\n";
    measure("deserialize", ops, text.size(), [&] {
      model::Root next{};
      parse(text, next); blackbox(next); value = std::move(next);
    });
    measure("serialize", ops, text.size(), [&] {
      std::string next; check(model::to_owned_json(value, next));
      blackbox(next); output = std::move(next);
    });
    blackbox(output);
    return 0;
  } catch (const std::exception &error) { std::cerr << error.what() << "\n"; return 1; }
}
