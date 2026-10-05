import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/tables/DataTable.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listCustomers, type CustomerSummary } from "./api.ts";

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [country, setCountry] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    customerType: customerType || undefined,
    country: country.length === 2 ? country : undefined,
    cursor,
    limit: 50,
  };
  const customers = useQuery({
    queryKey: queryKeys.list("customers", params),
    queryFn: () => listCustomers(params),
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-600">Master data for the companies and people you sell to.</p>
        </div>
        <Link to="/customers/new">
          <Button>New customer</Button>
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Input value={q} placeholder="Search number, name, email, phone" onChange={(event) => reset(setQ, event.target.value)} />
        <select className="h-9 rounded-md border border-slate-300 px-3 text-sm" value={status} onChange={(event) => reset(setStatus, event.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select className="h-9 rounded-md border border-slate-300 px-3 text-sm" value={customerType} onChange={(event) => reset(setCustomerType, event.target.value)}>
          <option value="">All types</option>
          <option value="COMPANY">Company</option>
          <option value="INDIVIDUAL">Individual</option>
        </select>
        <Input value={country} placeholder="Country, such as PK" maxLength={2} onChange={(event) => reset(setCountry, event.target.value.toUpperCase())} />
      </div>
      <DataTable
        columns={[
          { id: "number", header: "Number", cell: (row: CustomerSummary) => row.customerNumber },
          {
            id: "name",
            header: "Name",
            cell: (row: CustomerSummary) => (
              <Link className="font-medium text-slate-900 underline" to={`/customers/${row.id}`}>
                {row.displayName}
              </Link>
            ),
          },
          { id: "type", header: "Type", cell: (row: CustomerSummary) => row.customerType },
          { id: "email", header: "Email", cell: (row: CustomerSummary) => row.email ?? "—" },
          { id: "country", header: "Country", cell: (row: CustomerSummary) => row.countryCode },
          { id: "currency", header: "Currency", cell: (row: CustomerSummary) => row.currencyCode },
          { id: "status", header: "Status", cell: (row: CustomerSummary) => row.status },
          {
            id: "primary",
            header: "Primary contact",
            cell: (row: CustomerSummary) => row.contacts?.[0]?.displayName ?? "—",
          },
        ]}
        rows={customers.data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={customers.isPending}
        error={customers.isError ? getApiErrorMessage(customers.error) : null}
        emptyMessage="No customers match these filters."
        hasNextPage={customers.data?.pageInfo.hasNextPage ?? false}
        hasPreviousPage={cursors.length > 1}
        onNext={() => {
          const next = customers.data?.pageInfo.nextCursor;
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
