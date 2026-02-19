# DuckDB SQL Playground

A browser-based SQL playground powered by [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm). Upload CSV files and query them with SQL — everything runs entirely in your browser with no server required.

**Live site:** https://cyyeh.github.io/duckdb-web/

## Features

### SQL Playground

- **In-browser SQL engine** — DuckDB compiled to WebAssembly, no server required
- **CSV file upload** — Drag-and-drop or click to import CSV files (up to 500 MB) with automatic schema detection
- **Sample dataset** — One-click load of the Titanic dataset to get started quickly
- **SQL query editor** — Write and execute queries with Ctrl+Enter
- **Results table** — Sortable columns, per-column filters, and global search across results
- **EXPLAIN support** — Markdown-rendered output for `EXPLAIN` and `EXPLAIN ANALYZE` queries
- **Collapsible table sidebar** — Browse uploaded tables, inspect columns and types, toggle to expand your workspace

### AI Agent

- **Natural language data analysis** — Ask questions about your data in plain English and get SQL queries + results
- **Powered by Claude** — Uses the Anthropic SDK to stream responses with tool use
- **Thinking steps** — Collapsible thinking block shows the agent's reasoning and intermediate SQL queries
- **Inline query results** — SQL results displayed inline within the conversation

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 to use the playground.

### Environment Variables

Copy `.env.example` to `.env` and add your Anthropic API key:

```
CLAUDE_API_KEY=sk-ant-...
```

The API key is required for the AI agent feature. The SQL playground works without it.

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
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)

## License

[MIT](LICENSE)
