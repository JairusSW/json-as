# Contributing to json-as

Thank you for your interest in contributing to json-as! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/json-as.git
   cd json-as
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/JairusSW/json-as.git
   ```

## Development Setup

### Prerequisites

- Node.js 18+ or Bun
- Wasmtime (for running tests)

### Install Dependencies

```bash
npm install
# or
bun install
```

### Build the Transform

The transform is written in TypeScript and needs to be compiled:

```bash
npm run build:transform
```

### Running Tests

Run the full test suite across all modes (NAIVE, SWAR, SIMD):

```bash
npm test
```

Run a specific test file:

```bash
./run-tests.sh string  # Runs string.spec.ts
```

### Running Benchmarks

AssemblyScript benchmarks:
```bash
npm run bench:as
```

JavaScript comparison benchmarks:
```bash
npm run bench:js
```

## Project Structure

```
json-as/
├── assembly/           # AssemblyScript runtime implementation
│   ├── index.ts       # Main entry point (JSON namespace)
│   ├── serialize/     # Serialization implementations
│   │   ├── simple/    # Naive implementation
│   │   ├── swar/      # SWAR-optimized
│   │   └── simd/      # SIMD-optimized
│   ├── deserialize/   # Deserialization implementations
│   ├── util/          # Utility functions
│   ├── custom/        # Constants and character codes
│   └── __tests__/     # Test files
├── transform/          # TypeScript compiler transform
│   └── src/           # Transform source code
├── lib/               # Shared utilities (buffer system)
├── bench/             # Benchmark suite
└── .github/           # CI/CD workflows
```

## Making Changes

### Branching Strategy

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes with clear, atomic commits

3. Keep your branch up to date:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add support for BigInt serialization`
- `fix: handle escaped unicode in strings`
- `perf: optimize SIMD string escaping`
- `docs: update README examples`
- `test: add edge case tests for nested arrays`
- `chore: update dependencies`

## Testing

### Writing Tests

Tests are located in `assembly/__tests__/`. Each test file follows the pattern `*.spec.ts`.

Example test structure:

```typescript
import { JSON } from "..";

describe("Feature Name", () => {
  test("should serialize correctly", () => {
    const result = JSON.stringify<string>("hello");
    expect(result).toBe('"hello"');
  });

  test("should deserialize correctly", () => {
    const result = JSON.parse<string>('"hello"');
    expect(result).toBe("hello");
  });
});
```

### Test Coverage

Ensure your changes include tests for:
- Happy path scenarios
- Edge cases
- Error conditions
- All three modes (NAIVE, SWAR, SIMD) if applicable

## Code Style

### Formatting

The project uses Prettier for formatting:

```bash
npm run format
```

### AssemblyScript Guidelines

- Use `@inline` decorator for small, frequently-called functions
- Prefer `store<T>` and `load<T>` for direct memory operations
- Use typed arrays and explicit types
- Add `// @ts-ignore` comments with explanations when necessary

### TypeScript Guidelines (Transform)

- Use strict TypeScript settings
- Document complex logic with comments
- Keep functions focused and small

## Pull Request Process

1. **Before submitting:**
   - Run the full test suite: `npm test`
   - Run the formatter: `npm run format`
   - Ensure your branch is up to date with `main`

2. **PR Description:**
   - Clearly describe the changes
   - Reference any related issues
   - Include before/after benchmarks for performance changes

3. **Review Process:**
   - PRs require at least one approval
   - Address review feedback promptly
   - Keep the PR focused on a single concern

4. **After Merge:**
   - Delete your feature branch
   - Update any related issues

## Reporting Issues

### Bug Reports

Include:
- json-as version
- AssemblyScript version
- Minimal reproduction case
- Expected vs actual behavior
- Error messages (if any)

### Feature Requests

Include:
- Use case description
- Proposed API (if applicable)
- Alternatives considered

## Performance Contributions

If your change affects performance:

1. Run benchmarks before and after
2. Include benchmark results in the PR
3. Test across all three modes (NAIVE, SWAR, SIMD)
4. Consider memory usage implications

## Questions?

- Open a GitHub Discussion for general questions
- Join the [AssemblyScript Discord](https://discord.gg/assemblyscript)
- Email the maintainer at [me@jairus.dev](mailto:me@jairus.dev)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
