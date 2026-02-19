import { useState, useCallback } from 'react';
import { useDuckDB } from './useDuckDB';
import { FileUpload } from './components/FileUpload';
import { QueryEditor } from './components/QueryEditor';
import { ResultsTable } from './components/ResultsTable';
import { Sidebar } from './components/Sidebar';
import { ErrorMessage } from './components/ErrorMessage';
import type { TableInfo, QueryResult } from './types';
import './App.css';

function sanitizeTableName(filename: string): string {
  const base = filename.replace(/\.csv$/i, '');
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^[^a-z]/, 't_$&')
    .replace(/_+/g, '_')
    .replace(/_$/, '');
  return sanitized || 'table';
}

export default function App() {
  const { db, conn, loading, error: dbError } = useDuckDB();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorQuery, setEditorQuery] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const refreshTables = useCallback(async () => {
    if (!conn) return;
    try {
      const tablesResult = await conn.query('SHOW TABLES');
      const tableNames = tablesResult.toArray().map((row) => {
        const obj = row.toJSON();
        return (obj.name as string) ?? (Object.values(obj)[0] as string);
      });

      const tableInfos: TableInfo[] = [];
      for (const name of tableNames) {
        const descResult = await conn.query(`DESCRIBE "${name}"`);
        const columns = descResult.toArray().map((row) => {
          const obj = row.toJSON();
          return {
            name: obj.column_name as string,
            type: obj.column_type as string,
          };
        });
        const countResult = await conn.query(
          `SELECT COUNT(*) as cnt FROM "${name}"`
        );
        const rowCount = Number(countResult.toArray()[0].toJSON().cnt);
        tableInfos.push({ name, columns, rowCount });
      }
      setTables(tableInfos);
    } catch (e) {
      console.error('Failed to refresh tables:', e);
    }
  }, [conn]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!db || !conn) return;
      setError(null);
      try {
        const tableName = sanitizeTableName(file.name);
        const buffer = await file.arrayBuffer();
        await db.registerFileBuffer(file.name, new Uint8Array(buffer));
        await conn.query(
          `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}')`
        );
        await refreshTables();
        setEditorQuery(`SELECT * FROM "${tableName}" LIMIT 100`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to upload file');
      }
    },
    [db, conn, refreshTables]
  );

  const handleQueryExecute = useCallback(
    async (sql: string) => {
      if (!conn) return;
      setError(null);
      setQueryResult(null);
      try {
        const start = performance.now();
        const result = await conn.query(sql);
        const elapsed = performance.now() - start;

        const rows = result.toArray().map((row) => row.toJSON());
        const columns = result.schema.fields.map((f) => f.name);

        setQueryResult({
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: elapsed,
        });

        // Refresh tables in case of DDL statements
        await refreshTables();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Query execution failed');
      }
    },
    [conn, refreshTables]
  );

  const handleTableClick = useCallback((tableName: string) => {
    setEditorQuery(`SELECT * FROM "${tableName}" LIMIT 100`);
  }, []);

  if (loading) {
    return <div className="app-loading">Initializing DuckDB...</div>;
  }

  if (dbError) {
    return (
      <div className="app-error">Failed to initialize DuckDB: {dbError}</div>
    );
  }

  return (
    <div className={`app ${sidebarCollapsed ? 'app--sidebar-collapsed' : ''}`}>
      <div className="app__sidebar-wrapper">
        <Sidebar tables={tables} onTableClick={handleTableClick} collapsed={sidebarCollapsed} />
        <button
          className="app__sidebar-toggle"
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '\u25B6' : '\u25C0'}
        </button>
      </div>
      <main className="app__main">
        <h1 className="app__title">DuckDB SQL Playground</h1>
        <FileUpload onUpload={handleFileUpload} />
        <QueryEditor
          onExecute={handleQueryExecute}
          initialQuery={editorQuery}
        />
        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}
        <ResultsTable result={queryResult} />
      </main>
    </div>
  );
}
