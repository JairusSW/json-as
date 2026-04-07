cmake_minimum_required(VERSION 3.20)
project(native_dtoa_head2head LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

FetchContent_Declare(
  dragonbox
  GIT_REPOSITORY https://github.com/jk-jeon/dragonbox.git
  GIT_TAG master
)

FetchContent_Declare(
  double_conversion
  GIT_REPOSITORY https://github.com/google/double-conversion.git
  GIT_TAG master
)

FetchContent_GetProperties(dragonbox)
if(NOT dragonbox_POPULATED)
  FetchContent_Populate(dragonbox)
endif()

FetchContent_GetProperties(double_conversion)
if(NOT double_conversion_POPULATED)
  FetchContent_Populate(double_conversion)
endif()

add_library(dragonbox_to_chars STATIC
  ${dragonbox_SOURCE_DIR}/source/dragonbox_to_chars.cpp
)
target_include_directories(dragonbox_to_chars PUBLIC ${dragonbox_SOURCE_DIR}/include)

add_library(double_conversion_local STATIC
  ${double_conversion_SOURCE_DIR}/double-conversion/bignum-dtoa.cc
  ${double_conversion_SOURCE_DIR}/double-conversion/bignum.cc
  ${double_conversion_SOURCE_DIR}/double-conversion/cached-powers.cc
  ${double_conversion_SOURCE_DIR}/double-conversion/double-to-string.cc
  ${double_conversion_SOURCE_DIR}/double-conversion/fast-dtoa.cc
  ${double_conversion_SOURCE_DIR}/double-conversion/fixed-dtoa.cc
  ${double_conversion_SOURCE_DIR}/double-conversion/string-to-double.cc
  ${double_conversion_SOURCE_DIR}/double-conversion/strtod.cc
)
target_include_directories(double_conversion_local PUBLIC ${double_conversion_SOURCE_DIR})

add_executable(native_dtoa_head2head main.cpp)
target_link_libraries(native_dtoa_head2head PRIVATE dragonbox_to_chars double_conversion_local)
target_compile_options(native_dtoa_head2head PRIVATE -O3 -march=native -DNDEBUG)
