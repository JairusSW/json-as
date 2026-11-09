// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

/* Host imports for the exact same standalone AS benchmark Wasm used by V8. */
#include "parity.h"
#include <stdio.h>
#include <time.h>
#include <limits.h>

static void fail(const char *message) {
    fprintf(stderr, "w2c2 host: %s\n", message);
    exit(1);
}

void trap(Trap reason) {
    fprintf(stderr, "w2c2 trap: %s\n", trapDescription(reason));
    exit(1);
}

static U16 unit(const U8 *data) {
    return (U16)(data[0] | ((U16)data[1] << 8));
}

static char *utf8(wasmModuleInstance *instance, U32 pointer, size_t *length) {
    wasmMemory *memory = m6_parityExport6_memory((m6_parityInstance *)instance);
    U32 bytes;
    size_t written = 0, index;
    char *result;
    if (pointer < 4 || pointer > memory->size) fail("Invalid string pointer");
    bytes = (U32)unit(memory->data + pointer - 4) |
        ((U32)unit(memory->data + pointer - 2) << 16);
    if ((bytes & 1) || bytes > memory->size - pointer) fail("Invalid string extent");
    result = (char *)malloc((size_t)bytes / 2 * 3 + 1);
    if (!result) fail("UTF-8 allocation failed");
    for (index = 0; index < bytes; index += 2) {
        U32 code = unit(memory->data + pointer + index);
        if (code >= 0xd800 && code <= 0xdbff && index + 2 < bytes) {
            U32 low = unit(memory->data + pointer + index + 2);
            if (low >= 0xdc00 && low <= 0xdfff) {
                code = 0x10000 + ((code - 0xd800) << 10) + low - 0xdc00;
                index += 2;
            }
        }
        if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
        if (code < 0x80) result[written++] = (char)code;
        else if (code < 0x800) {
            result[written++] = (char)(0xc0 | (code >> 6));
            result[written++] = (char)(0x80 | (code & 63));
        } else if (code < 0x10000) {
            result[written++] = (char)(0xe0 | (code >> 12));
            result[written++] = (char)(0x80 | ((code >> 6) & 63));
            result[written++] = (char)(0x80 | (code & 63));
        } else {
            result[written++] = (char)(0xf0 | (code >> 18));
            result[written++] = (char)(0x80 | ((code >> 12) & 63));
            result[written++] = (char)(0x80 | ((code >> 6) & 63));
            result[written++] = (char)(0x80 | (code & 63));
        }
    }
    result[written] = 0;
    if (length) *length = written;
    return result;
}

void i3_env5_abort(wasmModuleInstance *instance, U32 message, U32 file, U32 line, U32 column) {
    char *text = utf8(instance, message, NULL), *source = utf8(instance, file, NULL);
    fprintf(stderr, "abort: %s in %s:%u:%u\n", text, source, line, column);
    free(text); free(source); exit(1);
}

void i3_env11_consoleX2Elog(wasmModuleInstance *instance, U32 pointer) {
    size_t length;
    char *text = utf8(instance, pointer, &length);
    fwrite(text, 1, length, stdout); fputc('\n', stdout); free(text);
}

F64 i3_env15_performanceX2Enow(wasmModuleInstance *instance) {
    struct timespec now;
    (void)instance;
    if (clock_gettime(CLOCK_MONOTONIC, &now)) fail("Clock failed");
    return (F64)now.tv_sec * 1000.0 + (F64)now.tv_nsec / 1000000.0;
}

void i3_env9_writeFile(wasmModuleInstance *instance, U32 name, U32 value) {
    char *path = utf8(instance, name, NULL);
    const char *folder = getenv("W2C2_ORACLE_DIR");
    const char *base = strrchr(path, '/');
    char *destination;
    size_t length;
    char *data = utf8(instance, value, &length);
    FILE *file;
    if (!folder) fail("W2C2_ORACLE_DIR is required to preserve V8 artifacts");
    base = base ? base + 1 : path;
    destination = (char *)malloc(strlen(folder) + strlen(base) + 2);
    if (!destination) fail("Output path allocation failed");
    sprintf(destination, "%s/%s", folder, base);
    file = fopen(destination, "wb");
    if (!file || fwrite(data, 1, length, file) != length || fclose(file)) fail("Output failed");
    free(path); free(destination); free(data);
}

U32 i3_env8_readFile(wasmModuleInstance *instance, U32 name) {
    char *path = utf8(instance, name, NULL);
    FILE *file = fopen(path, "rb");
    long length;
    U8 *bytes;
    U32 pointer;
    wasmMemory *memory;
    free(path);
    if (!file || fseek(file, 0, SEEK_END) || (length = ftell(file)) < 0 ||
        (unsigned long)length > UINT_MAX || fseek(file, 0, SEEK_SET)) fail("Input extent failed");
    bytes = (U8 *)malloc(length ? (size_t)length : 1);
    if (!bytes || fread(bytes, 1, (size_t)length, file) != (size_t)length || fclose(file)) fail("Input read failed");
    pointer = m6_parityExport5_X5FX5Fnew((m6_parityInstance *)instance, (U32)length, 1);
    memory = m6_parityExport6_memory((m6_parityInstance *)instance);
    if (pointer > memory->size || (U64)length > memory->size - pointer) fail("Input allocation failed");
    memcpy(memory->data + pointer, bytes, (size_t)length);
    free(bytes);
    return pointer;
}

int main(void) {
    m6_parityInstance instance;
    m6_parityInstantiate(&instance, NULL);
    m6_parityExport5_start(&instance);
    m6_parityFreeInstance(&instance);
    return 0;
}
