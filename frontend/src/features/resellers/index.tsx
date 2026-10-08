import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/tables/DataTable.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listResellers, type ResellerSummary } from "./api.ts";

export default function ResellersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    country: country.length === 2 ? country : undefined,
    cursor,
    limit: 50,
  };
  const resellers = useQuery({
    queryKey: queryKeys.list("resellers", params),
    queryFn: () => listResellers(params),
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Resellers</h1>
          <p className="mt-1 text-sm text-slate-600">Channel partners that sell ITCS products and services.</p>
        </div>
        <Link to="/resellers/new">
          <Button>New reseller</Button>
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input value={q} placeholder="Search number, name, email, phone" onChange={(event) => reset(setQ, event.target.value)} />
        <select className="h-9 rounded-md border border-slate-300 px-3 text-sm" value={status} onChange={(event) => reset(setStatus, event.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <Input value={country} placeholder="Country, such as PK" maxLength={2} onChange={(event) => reset(setCountry, event.target.value.toUpperCase())} />
      </div>
      <DataTable
        columns={[
          { id: "number", header: "Number", cell: (row: ResellerSummary) => row.resellerNumber },
          {
            id: "name",
            header: "Name",
            cell: (row: ResellerSummary) => (
              <Link className="font-medium text-slate-900 underline" to={`/resellers/${row.id}`}>
                {row.displayName}
              </Link>
            ),
          },
          { id: "email", header: "Email", cell: (row: ResellerSummary) => row.email ?? "—" },
          { id: "country", header: "Country", cell: (row: ResellerSummary) => row.countryCode },
          { id: "list", header: "Price list", cell: (row: ResellerSummary) => row.priceListCode },
          { id: "status", header: "Status", cell: (row: ResellerSummary) => row.status },
          {
            id: "customers",
            header: "Customers",
            cell: (row: ResellerSummary) => row._count?.customers ?? 0,
          },
        ]}
        rows={resellers.data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={resellers.isPending}
        error={resellers.isError ? getApiErrorMessage(resellers.error) : null}
        emptyMessage="No resellers match these filters."
        hasNextPage={resellers.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = resellers.data?.pageInfo.nextCursor;
          if (next) {
            setCursors((current) => [...current, next]);
          }
        }}
        onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
      />
    </section>
  );

  function reset(setter: (value: string) => void, value: string) {
    setter(value);
    setCursors([undefined]);
  }
}
