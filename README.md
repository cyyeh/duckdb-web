# DuckDB SQL Playground

A browser-based SQL playground powered by [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm). Upload CSV files and query them with SQL — everything runs entirely in your browser.

## Features

- **In-browser SQL engine** — DuckDB compiled to WebAssembly, no server required
- **CSV file upload** — Drag-and-drop or click to import CSV files (up to 500 MB)
- **SQL query editor** — Write and execute queries with Ctrl+Enter
- **Results table** — View query results with column names, row counts, and execution time
- **Table sidebar** — Browse uploaded tables, inspect columns and types

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

Live site: https://cyyeh.github.io/duckdb-web/

## Tech Stack

- React 18
- TypeScript
- Vite
- DuckDB-WASM
- Apache Arrow
