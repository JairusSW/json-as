// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

#pragma once
#include <array>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>

static_assert(SIMDJSON_STATIC_REFLECTION, "The parity baseline requires reflection support");

inline void require_success(simdjson::error_code error) {
  if (error) throw std::runtime_error(simdjson::error_message(error));
}

template<class T>
void parse_owned(simdjson::ondemand::parser &parser, simdjson::dom::parser &validator, const simdjson::padded_string &input, T &out) {
  if constexpr (model::requires_raw_validation) {
    simdjson::dom::element document;
    require_success(validator.parse(input).get(document));
  }
  simdjson::ondemand::document doc;
  require_success(parser.iterate(input).get(doc));
  require_success(doc.get(out));
  if (!doc.at_end()) throw std::runtime_error("Trailing content after typed parse");
}

template<class F> void measure(const char *phase, size_t iterations, F &&routine) {
  for (size_t i=1; i<iterations/10; i++) routine();
  const auto start=std::chrono::steady_clock::now();
  for (size_t i=0;i<iterations;i++) routine();
  const auto stop=std::chrono::steady_clock::now();
  const auto ns=std::chrono::duration<double,std::nano>(stop-start).count()/double(iterations);
  std::cout<<"PARITY {\"phase\":\""<<phase<<"\",\"ns\":"<<std::fixed<<std::setprecision(2)<<ns<<",\"iterations\":"<<iterations<<"}\n";
}

template<class T> inline void blackbox(const T &value) { asm volatile("" : : "g"(&value) : "memory"); }

int main(int argc,char **argv) {
  try {
    if(argc!=4)throw std::runtime_error("usage: native input-prefix iterations output-prefix");
    const std::string prefix=argv[1];const size_t iterations=std::stoull(argv[2]);const std::string output=argv[3];
    std::array<simdjson::padded_string,4> inputs;
    std::array<model::Root,4> objects{};
    std::array<model::Root,8> retained{};
    std::array<std::string,8> retained_strings{};
    simdjson::ondemand::parser parser;
    simdjson::dom::parser raw_validator;
    for(size_t i=0;i<4;i++) {
      require_success(simdjson::padded_string::load(prefix+"."+std::to_string(i)+".json").get(inputs[i]));
      parse_owned(parser,raw_validator,inputs[i],objects[i]);
      std::string serialized;
      require_success(model::to_owned_json(objects[i],serialized));
      std::ofstream out(output+"."+std::to_string(i)+".json",std::ios::binary);out<<serialized;
      if(!out)throw std::runtime_error("Cannot write owned-output oracle");
    }
    std::cout<<"IMPLEMENTATION "<<simdjson::get_active_implementation()->name()<<"\n";
    size_t index=0,slot=0;
    measure("parse-owned",iterations,[&]{
      model::Root value{};
      parse_owned(parser,raw_validator,inputs[index],value);index=(index+1)&3;
      retained[slot]=std::move(value);blackbox(retained[slot]);slot=(slot+1)&7;
    });
    measure("serialize-owned",iterations,[&]{
      std::string value;
      require_success(model::to_owned_json(objects[index],value));index=(index+1)&3;
      retained_strings[slot]=std::move(value);blackbox(retained_strings[slot]);slot=(slot+1)&7;
    });
    simdjson::dom::parser validator;
    measure("validate",iterations,[&]{
      simdjson::dom::element document;
      require_success(validator.parse(inputs[index]).get(document));index=(index+1)&3;
      blackbox(document);
    });
    for(size_t i=0;i<8;i++) {
      std::string serialized;
      require_success(model::to_owned_json(retained[i],serialized));
      std::ofstream(output+".retained-object."+std::to_string(i)+".json",std::ios::binary)<<serialized;
      std::ofstream(output+".retained-string."+std::to_string(i)+".json",std::ios::binary)<<retained_strings[i];
    }
    return 0;
  } catch(const std::exception &error) { std::cerr<<"PARITY_ERROR "<<error.what()<<"\n";return 1; }
}
