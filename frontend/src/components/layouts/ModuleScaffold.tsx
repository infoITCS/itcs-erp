import { useState } from "react";
import { DataTable } from "@/components/tables/DataTable.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";

interface ModuleScaffoldProps {
  title: string;
  description: string;
  group?: string;
}

interface EmptyRow {
  id: string;
}

const columns = [
  {
    id: "record",
    header: "Record",
    cell: (row: EmptyRow) => row.id,
  },
];

export function ModuleScaffold({ title, description, group = "Coming soon" }: ModuleScaffoldProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            {group}
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
          Scaffold · UI ready
        </span>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-4 sm:divide-y-0">
        <SummaryItem label="Visible" value="0" />
        <SummaryItem label="Active" value="—" />
        <SummaryItem label="Draft" value="—" />
        <SummaryItem label="Closed" value="—" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="max-w-md">
          <Input
            className="h-10"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search this list"
            aria-label={`Search ${title}`}
          />
          <p className="mt-2 text-xs text-slate-500">
            {debouncedSearch
              ? `A paged request will use q="${debouncedSearch}". The full table is never loaded.`
              : "Search waits until you pause typing, then requests one page."}
          </p>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">{title} list</h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">0</span>
        </div>
        <div className="p-1">
          <DataTable
            columns={columns}
            rows={[]}
            getRowId={(row) => row.id}
            emptyMessage="No page has been requested yet. Lists stay empty until a cursor query runs."
          />
        </div>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[76px] flex-col justify-center px-4 py-3 first:pl-0 sm:pl-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}
