import { useState } from "react";
import { DataTable } from "@/components/tables/DataTable.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";

interface ModuleScaffoldProps {
  title: string;
  description: string;
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

export function ModuleScaffold({ title, description }: ModuleScaffoldProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      <div className="max-w-sm">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Search this list"
          aria-label={`Search ${title}`}
        />
        <p className="mt-1 text-xs text-slate-500">
          {debouncedSearch
            ? `A paged request will use q="${debouncedSearch}". The full table is never loaded.`
            : "Search waits until you pause typing, then requests one page."}
        </p>
      </div>
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(row) => row.id}
        emptyMessage="No page has been requested yet. Lists stay empty until a cursor query runs."
      />
    </section>
  );
}
