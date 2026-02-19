import type Anthropic from '@anthropic-ai/sdk';

export const executeSqlTool: Anthropic.Tool = {
  name: 'execute_sql',
  description:
    'Execute a SQL query against the in-browser DuckDB database. Use this to query loaded tables, create views, or run any valid DuckDB SQL. Results are returned as JSON rows.',
  input_schema: {
    type: 'object' as const,
    properties: {
      sql: {
        type: 'string',
        description: 'The SQL query to execute',
      },
    },
    required: ['sql'],
  },
};
