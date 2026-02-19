import { useState, useCallback } from 'react';
import { useDuckDB } from './useDuckDB';
import { AgentProvider, useAgent } from './AgentContext';
import { FileUpload } from './components/FileUpload';
import { QueryEditor } from './components/QueryEditor';
import { ResultsTable } from './components/ResultsTable';
import { ResultMarkdown } from './components/ResultMarkdown';
import { Sidebar } from './components/Sidebar';
import { ErrorMessage } from './components/ErrorMessage';
import { AgentPanel } from './components/AgentPanel';
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

function AppContent({ tables, refreshTables }: { tables: TableInfo[]; refreshTables: () => Promise<void> }) {
  const { db, conn } = useDuckDB();
  const { apiKey, setApiKey } = useAgent();
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorQuery, setEditorQuery] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const handleAgentToggle = () => {
    if (agentOpen) {
      setAgentOpen(false);
    } else if (apiKey) {
      setAgentOpen(true);
    } else {
      setApiKeyInput('');
      setShowApiKeyDialog(true);
    }
  };

  const handleApiKeySave = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setShowApiKeyDialog(false);
    setAgentOpen(true);
  };

  const handleLoadSample = useCallback(async () => {
    if (!db || !conn) return;
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}titanic.csv`);
      if (!response.ok) throw new Error('Failed to fetch sample dataset');
      const buffer = await response.arrayBuffer();
      await db.registerFileBuffer('titanic.csv', new Uint8Array(buffer));
      await conn.query(
        `CREATE OR REPLACE TABLE "titanic" AS SELECT * FROM read_csv_auto('titanic.csv')`
      );
      await refreshTables();
      setEditorQuery(`SELECT * FROM "titanic" LIMIT 100`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sample dataset');
    }
  }, [db, conn, refreshTables]);

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
        const isExplain = sql.trim().match(/^EXPLAIN\b/i) !== null;

        setQueryResult({
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs: elapsed,
          resultType: isExplain ? 'markdown' : 'table',
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

  const appClass = [
    'app',
    sidebarCollapsed ? 'app--sidebar-collapsed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={appClass}>
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
      {agentOpen ? (
        <div className="app__agent-wrapper">
          <div className="app__header">
            <h1 className="app__title">DuckDB SQL Playground</h1>
            <button
              className="app__agent-toggle app__agent-toggle--active"
              onClick={handleAgentToggle}
            >
              Editor Mode
            </button>
          </div>
          <AgentPanel />
        </div>
      ) : (
        <main className="app__main">
          <div className="app__header">
            <h1 className="app__title">DuckDB SQL Playground</h1>
            <button
              className="app__agent-toggle"
              onClick={handleAgentToggle}
            >
              Agent Mode
            </button>
          </div>
          <FileUpload onUpload={handleFileUpload} onLoadSample={handleLoadSample} />
          <QueryEditor
            onExecute={handleQueryExecute}
            initialQuery={editorQuery}
          />
          {error && (
            <ErrorMessage message={error} onDismiss={() => setError(null)} />
          )}
          {queryResult?.resultType === 'markdown' ? (
            <ResultMarkdown result={queryResult} />
          ) : (
            <ResultsTable result={queryResult} />
          )}
        </main>
      )}
      {showApiKeyDialog && (
        <div className="api-key-dialog__overlay" onClick={() => setShowApiKeyDialog(false)}>
          <div className="api-key-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="api-key-dialog__title">Enter Anthropic API Key</h2>
            <p className="api-key-dialog__desc">
              An API key is required to use Agent Mode. The key is kept in memory only and will be cleared when you close or refresh the page.
            </p>
            <input
              type="password"
              className="api-key-dialog__input"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              onKeyDown={(e) => { if (e.key === 'Enter') handleApiKeySave(); }}
              autoFocus
            />
            <div className="api-key-dialog__actions">
              <button className="api-key-dialog__cancel" onClick={() => setShowApiKeyDialog(false)}>
                Cancel
              </button>
              <button className="api-key-dialog__save" onClick={handleApiKeySave} disabled={!apiKeyInput.trim()}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { loading, error: dbError, conn } = useDuckDB();
  const [tables, setTables] = useState<TableInfo[]>([]);

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

  if (loading) {
    return <div className="app-loading">Initializing DuckDB...</div>;
  }

  if (dbError) {
    return (
      <div className="app-error">Failed to initialize DuckDB: {dbError}</div>
    );
  }

  return (
    <AgentProvider tables={tables} refreshTables={refreshTables}>
      <AppContent tables={tables} refreshTables={refreshTables} />
    </AgentProvider>
  );
}
