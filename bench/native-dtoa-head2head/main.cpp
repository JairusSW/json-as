#include <algorithm>
#include <array>
#include <bit>
#include <charconv>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <random>
#include <sstream>
#include <string>
#include <string_view>
#include <type_traits>
#include <vector>

#include "double-conversion/double-conversion.h"
#include "double-conversion/fast-dtoa.h"
#include "dragonbox/dragonbox.h"
#include "dragonbox/dragonbox_to_chars.h"

namespace {

using clock_type = std::chrono::steady_clock;
using double_conversion::DoubleToStringConverter;
using double_conversion::FastDtoa;
using double_conversion::FAST_DTOA_SHORTEST;
using double_conversion::FAST_DTOA_SHORTEST_SINGLE;
using double_conversion::StringBuilder;
using double_conversion::Vector;

template <class Float>
struct Corpus {
  std::string name;
  std::vector<Float> values;
};

template <class Float>
struct BenchResult {
  double ns_per_value{};
  double m_values_per_sec{};
  double mb_per_sec{};
  std::uint64_t checksum{};
  std::size_t successes{};
};

template <class Float>
constexpr bool is_finite_nonzero(Float x) noexcept {
  return std::isfinite(x) && x != Float(0);
}

template <class Float>
std::vector<Float> make_random_bit_corpus(std::size_t count, std::uint64_t seed) {
  std::vector<Float> out;
  out.reserve(count);
  std::mt19937_64 rng(seed);

  while (out.size() < count) {
    if constexpr (std::is_same_v<Float, double>) {
      std::uint64_t bits = rng();
      double x = std::bit_cast<double>(bits);
      if (is_finite_nonzero(x)) out.push_back(x);
    } else {
      std::uint32_t bits = static_cast<std::uint32_t>(rng());
      float x = std::bit_cast<float>(bits);
      if (is_finite_nonzero(x)) out.push_back(x);
    }
  }
  return out;
}

std::string read_file(std::string const& path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) {
    throw std::runtime_error("failed to open " + path);
  }
  std::ostringstream ss;
  ss << in.rdbuf();
  return ss.str();
}

std::string extract_canada_json(std::string const& ts_source) {
  auto begin = ts_source.find('`');
  auto end = ts_source.rfind('`');
  if (begin == std::string::npos || end == std::string::npos || begin >= end) {
    throw std::runtime_error("failed to find canadaJson template literal");
  }
  return ts_source.substr(begin + 1, end - begin - 1);
}

std::vector<double> collect_json_numbers(std::string_view json) {
  std::vector<double> out;
  out.reserve(150000);
  std::size_t i = 0;
  while (i < json.size()) {
    char c = json[i];
    if (c == '-' || (c >= '0' && c <= '9')) {
      std::size_t start = i++;
      while (i < json.size()) {
        char n = json[i];
        if ((n >= '0' && n <= '9') || n == '.' || n == 'e' || n == 'E' || n == '+' || n == '-') {
          ++i;
          continue;
        }
        break;
      }
      double value = 0;
      auto first = json.data() + start;
      auto last = json.data() + i;
      auto [ptr, ec] = std::from_chars(first, last, value);
      if (ec == std::errc{} && ptr == last && is_finite_nonzero(value)) {
        out.push_back(value);
      }
      continue;
    }
    ++i;
  }
  return out;
}

template <class Float>
std::vector<Float> narrow_corpus(std::vector<double> const& src) {
  std::vector<Float> out;
  out.reserve(src.size());
  for (double value : src) {
    Float x = static_cast<Float>(value);
    if (is_finite_nonzero(x)) out.push_back(x);
  }
  return out;
}

template <class Float>
inline std::uint64_t dragonbox_raw_impl(Float value) {
  auto decimal = jkj::dragonbox::to_decimal(
    value,
    jkj::dragonbox::policy::sign::return_sign,
    jkj::dragonbox::policy::decimal_to_binary_rounding::nearest_to_even,
    jkj::dragonbox::policy::binary_to_decimal_rounding::to_even);

  std::uint64_t checksum = static_cast<std::uint64_t>(decimal.exponent + 2048);
  checksum ^= static_cast<std::uint64_t>(decimal.significand) * 0x9E3779B185EBCA87ull;
  checksum ^= static_cast<std::uint64_t>(decimal.is_negative) << 63;
  return checksum;
}

template <class Float>
inline std::size_t dragonbox_chars_impl(Float value, char* buffer) {
  return static_cast<std::size_t>(jkj::dragonbox::to_chars_n(value, buffer) - buffer);
}

template <class Float>
inline bool grisu3_raw_impl(Float value, char* buffer, int& length, int& point) {
  if constexpr (std::is_same_v<Float, double>) {
    return FastDtoa(std::fabs(value), FAST_DTOA_SHORTEST, 0, Vector<char>(buffer, 64), &length, &point);
  } else {
    return FastDtoa(static_cast<double>(std::fabs(value)), FAST_DTOA_SHORTEST_SINGLE, 0, Vector<char>(buffer, 64), &length, &point);
  }
}

template <class Float>
inline bool grisu_shortest_impl(Float value, char* buffer, int& length) {
  StringBuilder builder(buffer, 128);
  bool ok;
  if constexpr (std::is_same_v<Float, double>) {
    ok = DoubleToStringConverter::EcmaScriptConverter().ToShortest(value, &builder);
  } else {
    ok = DoubleToStringConverter::EcmaScriptConverter().ToShortestSingle(value, &builder);
  }
  if (!ok) return false;
  length = builder.position();
  builder.Finalize();
  return true;
}

template <class Float, class Func>
BenchResult<Float> run_bench(std::vector<Float> const& values, Func&& func, std::size_t iterations) {
  volatile std::uint64_t sink = 0;
  std::size_t successes = 0;
  std::size_t warmup_successes = 0;

  for (std::size_t warm = 0; warm < std::min<std::size_t>(values.size(), 4096); ++warm) {
    sink ^= func(values[warm], warmup_successes);
  }

  auto const start = clock_type::now();
  for (std::size_t iter = 0; iter < iterations; ++iter) {
    for (Float value : values) {
      sink ^= func(value, successes);
    }
  }
  auto const end = clock_type::now();

  double elapsed_ns = std::chrono::duration<double, std::nano>(end - start).count();
  double total_values = static_cast<double>(values.size()) * static_cast<double>(iterations);
  double values_per_sec = total_values * 1'000'000'000.0 / elapsed_ns;
  double m_values_per_sec = values_per_sec / 1'000'000.0;
  double mb_per_sec = values_per_sec * sizeof(Float) / (1000.0 * 1000.0);

  return {
    elapsed_ns / total_values,
    m_values_per_sec / 1'000'000.0,
    mb_per_sec / (1000.0 * 1000.0),
    static_cast<std::uint64_t>(sink),
    successes,
  };
}

template <class Float>
void print_result(std::string const& label, BenchResult<Float> const& r, std::size_t total_calls) {
  std::cout << "  " << std::left << std::setw(24) << label
            << "  " << std::right << std::setw(8) << std::fixed << std::setprecision(2) << r.ns_per_value << " ns/value"
            << "  " << std::setw(8) << std::fixed << std::setprecision(2) << r.m_values_per_sec << " Mvals/s"
            << "  " << std::setw(8) << std::fixed << std::setprecision(2) << r.mb_per_sec << " MB/s";
  if (r.successes != 0 || total_calls != 0) {
    std::cout << "  success " << r.successes << "/" << total_calls;
  }
  std::cout << "  checksum " << r.checksum << "\n";
}

template <class Float>
void run_suite(Corpus<Float> const& corpus) {
  std::size_t iterations = corpus.values.size() < 150000 ? 20 : 8;
  std::size_t total_calls = corpus.values.size() * iterations;

  std::cout << "\n[" << corpus.name << "] count=" << corpus.values.size() << " type=" << (sizeof(Float) == 8 ? "f64" : "f32") << "\n";

  auto dragonbox_raw = run_bench<Float>(corpus.values, [](Float value, std::size_t& successes) {
    ++successes;
    return dragonbox_raw_impl(value);
  }, iterations);

  auto dragonbox_chars = run_bench<Float>(corpus.values, [](Float value, std::size_t& successes) {
    char buffer[jkj::dragonbox::max_output_string_length<
      std::conditional_t<sizeof(Float) == 8, jkj::dragonbox::ieee754_binary64, jkj::dragonbox::ieee754_binary32>> + 1];
    auto len = dragonbox_chars_impl(value, buffer);
    ++successes;
    return static_cast<std::uint64_t>(len) * 0x9E3779B185EBCA87ull;
  }, iterations);

  auto grisu3_raw = run_bench<Float>(corpus.values, [](Float value, std::size_t& successes) {
    char buffer[64];
    int len = 0;
    int point = 0;
    bool ok = grisu3_raw_impl(value, buffer, len, point);
    successes += static_cast<std::size_t>(ok);
    return ok ? (static_cast<std::uint64_t>(len) << 32) ^ static_cast<std::uint64_t>(point + 2048) : 0xDEADBEEF;
  }, iterations);

  auto grisu_shortest = run_bench<Float>(corpus.values, [](Float value, std::size_t& successes) {
    char buffer[128];
    int len = 0;
    bool ok = grisu_shortest_impl(value, buffer, len);
    successes += static_cast<std::size_t>(ok);
    return ok ? static_cast<std::uint64_t>(len) * 0x517CC1B727220A95ull : 0xBAD0BAD0;
  }, iterations);

  print_result("dragonbox raw", dragonbox_raw, total_calls);
  print_result("dragonbox to_chars", dragonbox_chars, total_calls);
  print_result("grisu3 raw", grisu3_raw, total_calls);
  print_result("grisu shortest", grisu_shortest, total_calls);
}

} // namespace

int main() try {
  auto canada_ts = read_file("assembly/__benches__/throughput/canada.generated.ts");
  auto canada_json = extract_canada_json(canada_ts);
  auto canada_f64_values = collect_json_numbers(canada_json);
  auto canada_f32_values = narrow_corpus<float>(canada_f64_values);

  Corpus<double> canada_f64{"canada corpus", std::move(canada_f64_values)};
  Corpus<float> canada_f32{"canada corpus", std::move(canada_f32_values)};
  Corpus<double> random_f64{"random finite bits", make_random_bit_corpus<double>(250000, 0xD06A6B0D12345678ull)};
  Corpus<float> random_f32{"random finite bits", make_random_bit_corpus<float>(250000, 0xD06A6B0DCAFEBABEull)};

  std::cout << "Dragonbox vs Grisu head-to-head\n";
  std::cout << "  Dragonbox raw: to_decimal(nearest_to_even, to_even)\n";
  std::cout << "  Dragonbox full: to_chars_n\n";
  std::cout << "  Grisu3 raw: double-conversion FastDtoa (no fallback)\n";
  std::cout << "  Grisu full: double-conversion EcmaScript ToShortest{Single}\n";

  run_suite(canada_f64);
  run_suite(canada_f32);
  run_suite(random_f64);
  run_suite(random_f32);
  return 0;
}
catch (std::exception const& ex) {
  std::cerr << "error: " << ex.what() << "\n";
  return 1;
}
