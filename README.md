# DuckDB SQL Playground

A browser-based SQL playground powered by [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm). Upload CSV files and query them with SQL — everything runs entirely in your browser with no server required.

**Live site:** https://cyyeh.github.io/duckdb-web/

## Features

- **In-browser SQL engine** — DuckDB compiled to WebAssembly, no server required
- **CSV file upload** — Drag-and-drop or click to import CSV files (up to 500 MB) with automatic schema detection
- **Sample dataset** — One-click load of the Titanic dataset to get started quickly
- **SQL query editor** — Write and execute queries with Ctrl+Enter
- **Results table** — View query results with column names, row counts, and execution time
- **Collapsible table sidebar** — Browse uploaded tables, inspect columns and types, toggle to expand your workspace

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 to use the playground.

## Build

```bash
npm run build
npm run preview
```

## Deployment

The project includes a GitHub Actions workflow that automatically deploys to GitHub Pages on push to `main`.

## Tech Stack

- [React](https://react.dev/) 18
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm)
- [Apache Arrow](https://arrow.apache.org/)

## License

[MIT](LICENSE)
