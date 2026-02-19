import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type * as duckdb from '@duckdb/duckdb-wasm';
import { initDuckDB } from './duckdb';

export interface DuckDBContextValue {
  db: duckdb.AsyncDuckDB | null;
  conn: duckdb.AsyncDuckDBConnection | null;
  loading: boolean;
  error: string | null;
}

export const DuckDBContext = createContext<DuckDBContextValue>({
  db: null,
  conn: null,
  loading: true,
  error: null,
});

export function DuckDBProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
  const [conn, setConn] = useState<duckdb.AsyncDuckDBConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let database: duckdb.AsyncDuckDB | null = null;
    let connection: duckdb.AsyncDuckDBConnection | null = null;

    (async () => {
      try {
        database = await initDuckDB();
        connection = await database.connect();
        setDb(database);
        setConn(connection);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to initialize DuckDB');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      connection?.close();
      database?.terminate();
    };
  }, []);

  return (
    <DuckDBContext.Provider value={{ db, conn, loading, error }}>
      {children}
    </DuckDBContext.Provider>
  );
}
