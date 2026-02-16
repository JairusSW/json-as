mkdir -p ./build/charts
bun ./scripts/build-chart01.ts
bun ./scripts/build-chart02.ts
bun ./scripts/build-chart03.ts
bun ./scripts/build-chart04.ts
serve ./build/charts
