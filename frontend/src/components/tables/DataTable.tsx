import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage: string;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
}

const MAX_RENDERED_ROWS = 100;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  error = null,
  emptyMessage,
  hasNextPage = false,
  hasPreviousPage = false,
  onNext,
  onPrevious,
}: DataTableProps<T>) {
  const visibleRows = rows.slice(0, MAX_RENDERED_ROWS);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.id} className="px-4 py-2.5 font-medium">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                  Loading page…
                </td>
              </tr>
            ) : null}
            {!isLoading && error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-red-700">
                  {error}
                </td>
              </tr>
            ) : null}
            {!isLoading && !error && visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
            {!isLoading && !error
              ? visibleRows.map((row) => (
                  <tr key={getRowId(row)} className="border-t border-slate-100">
                    {columns.map((column) => (
                      <td key={column.id} className="px-4 py-2.5 text-slate-800">
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-sm text-slate-500">
        <span>Showing {visibleRows.length} on this page</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasPreviousPage}
            onClick={onPrevious}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasNextPage}
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
