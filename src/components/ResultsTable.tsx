import type { QueryResult } from '../types';
import './ResultsTable.css';

interface ResultsTableProps {
  result: QueryResult | null;
}

const DISPLAY_CAP = 1000;

export function ResultsTable({ result }: ResultsTableProps) {
  if (!result) return null;

  const displayRows = result.rows.slice(0, DISPLAY_CAP);
  const truncated = result.rows.length > DISPLAY_CAP;

  return (
    <div className="results-table">
      <div className="results-table__summary">
        {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} in{' '}
        {result.executionTimeMs.toFixed(1)} ms
        {truncated && ` (showing first ${DISPLAY_CAP})`}
      </div>
      {result.columns.length > 0 && (
        <div className="results-table__scroll">
          <table className="results-table__table">
            <thead>
              <tr>
                {result.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr key={i}>
                  {result.columns.map((col) => (
                    <td key={col}>{formatCell(row[col])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
