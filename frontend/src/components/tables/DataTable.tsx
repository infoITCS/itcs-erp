import type { ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/features/purchasing/shared.tsx";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
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
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  sort?: { key: string; direction: "asc" | "desc" } | null;
  onSort?: (key: string) => void;
  onRetry?: () => void;
  onClearFilters?: () => void;
  backTo?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100];

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
  pageSize = 50,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  sort = null,
  onSort,
  onRetry,
  onClearFilters,
  backTo = "/",
}: DataTableProps<T>) {
  const colSpan = Math.max(columns.length, 1);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.id;
                const sortLabel = column.sortable && onSort ? `${column.header}, sort` : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={`px-4 py-2.5 font-medium ${column.align === "right" ? "text-right" : ""}`}
                  >
                    {column.sortable && onSort ? (
                      <button
                        type="button"
                        aria-label={sortLabel}
                        className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-slate-100 hover:text-slate-800"
                        onClick={() => onSort(column.id)}
                      >
                        {column.header}
                        <span className={`text-xs ${active ? "text-brand-800" : "text-slate-400"}`}>
                          {active ? (sort?.direction === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan}>
                  <LoadingState label="Loading records…" />
                </td>
              </tr>
            ) : null}
            {!isLoading && error ? (
              <tr>
                <td colSpan={colSpan}>
                  <ErrorState message={error} onRetry={onRetry} backTo={backTo} backLabel="Back to list" />
                </td>
              </tr>
            ) : null}
            {!isLoading && !error && rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptyState title="No matching records" description={emptyMessage} onClear={onClearFilters} backTo={backTo} backLabel="Back to list" />
                </td>
              </tr>
            ) : null}
            {!isLoading && !error
              ? rows.map((row) => (
                  <tr key={getRowId(row)} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                    {columns.map((column) => (
                      <td key={column.id} className={`px-4 py-2.5 text-slate-800 ${column.align === "right" ? "text-right" : ""}`}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        <span>Showing {rows.length} on this page</span>
        <div className="flex items-center gap-2">
          {onPageSizeChange ? (
            <label className="inline-flex items-center gap-2">
              <span>Rows</span>
              <select
                aria-label="Rows per page"
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasPreviousPage}
            onClick={onPrevious}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
