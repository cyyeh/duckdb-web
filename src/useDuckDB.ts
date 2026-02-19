import { useContext } from 'react';
import { DuckDBContext, type DuckDBContextValue } from './DuckDBContext';

export function useDuckDB(): DuckDBContextValue {
  return useContext(DuckDBContext);
}
