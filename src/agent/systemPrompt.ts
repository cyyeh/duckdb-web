import type { TableInfo } from '../types';

export function buildSystemPrompt(tables: TableInfo[]): string {
  let prompt = `You are a helpful data analyst assistant working with an in-browser DuckDB database.
You can execute SQL queries using the execute_sql tool to answer questions about the user's data.

Guidelines:
- Write clear, efficient DuckDB SQL queries
- When exploring data, start with small queries (use LIMIT)
- Explain your findings in plain language after getting results
- If a query fails, try to fix it and retry
- Use double quotes for table and column names that might conflict with reserved words
`;

  if (tables.length === 0) {
    prompt += '\nNo tables are currently loaded. Ask the user to upload a CSV file first.';
  } else {
    prompt += '\nCurrently loaded tables:\n';
    for (const table of tables) {
      prompt += `\nTable: "${table.name}" (${table.rowCount} rows)\nColumns:\n`;
      for (const col of table.columns) {
        prompt += `  - "${col.name}" (${col.type})\n`;
      }
    }
  }

  return prompt;
}
