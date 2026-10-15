import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/tables/DataTable.tsx";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createCategory,
  deleteCategory,
  listCategories,
  listProducts,
  type Category,
  type ProductSummary,
} from "./api.ts";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [productType, setProductType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] = useState<{ id: string; label: string } | null>(null);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const params = {
    q: debouncedQ || undefined,
    status: status || undefined,
    productType: productType || undefined,
    categoryId: categoryId || undefined,
    cursor,
    limit: 50,
  };
  const products = useQuery({
    queryKey: queryKeys.list("products", params),
    queryFn: () => listProducts(params),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const rows = products.data?.items ?? [];
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = rows.filter((row) => row.status === "INACTIVE").length;
  const productCount = rows.filter((row) => row.productType === "PHYSICAL_PRODUCT").length;
  const serviceCount = rows.filter((row) => row.productType === "SERVICE").length;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            Supply / Catalog
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">Products and services</h1>
          <p className="mt-1 text-sm text-slate-600">Catalog items with decimal prices, categories, and tax codes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-10" onClick={() => setCategoryOpen(true)}>
            Categories
          </Button>
          <Link to="/products/new">
            <Button className="h-10 bg-teal-800 px-4 hover:bg-teal-900">Add New Product</Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-5 sm:divide-y-0">
        <SummaryItem label="Visible" value={rows.length.toString()} tone="slate" />
        <SummaryItem label="Active" value={activeCount.toString()} tone="teal" />
        <SummaryItem label="Inactive" value={inactiveCount.toString()} tone="slate" />
        <SummaryItem label="Products" value={productCount.toString()} tone="teal" />
        <SummaryItem label="Services" value={serviceCount.toString()} tone="amber" />
      </div>

      <section aria-label="Product filters" className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            className="h-10"
            value={q}
            placeholder="Search code or name"
            onChange={(event) => reset(setQ, event.target.value)}
          />
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={status}
            onChange={(event) => reset(setStatus, event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={productType}
            onChange={(event) => reset(setProductType, event.target.value)}
          >
            <option value="">All types</option>
            <option value="PHYSICAL_PRODUCT">Physical product</option>
            <option value="SERVICE">Service</option>
          </select>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={categoryId}
            onChange={(event) => reset(setCategoryId, event.target.value)}
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Product catalog</h2>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{rows.length}</span>
        </div>
        <div className="p-1">
          <DataTable
            columns={[
              { id: "code", header: "Code", cell: (row: ProductSummary) => row.code },
              {
                id: "name",
                header: "Name",
                cell: (row: ProductSummary) => (
                  <Link className="font-semibold text-slate-950 underline-offset-4 hover:text-teal-800 hover:underline" to={`/products/${row.id}`}>
                    {row.name}
                  </Link>
                ),
              },
              {
                id: "type",
                header: "Type",
                cell: (row: ProductSummary) => (row.productType === "SERVICE" ? "Service" : "Physical product"),
              },
              { id: "uom", header: "UOM", cell: (row: ProductSummary) => row.unitOfMeasure.code },
              {
                id: "price",
                header: "Sales price",
                cell: (row: ProductSummary) => {
                  const price = row.prices?.[0];
                  return price ? `${price.amount} ${price.currencyCode}` : "—";
                },
              },
              { id: "status", header: "Status", cell: (row: ProductSummary) => row.status },
            ]}
            rows={rows}
            getRowId={(row) => row.id}
            isLoading={products.isPending}
            error={products.isError ? getApiErrorMessage(products.error) : null}
            emptyMessage="No products match these filters."
            hasNextPage={products.data?.pageInfo.hasNextPage ?? false}
            hasPreviousPage={cursors.length > 1}
            onNext={() => {
              const next = products.data?.pageInfo.nextCursor;
              if (next) {
                setCursors((current) => [...current, next]);
              }
            }}
            onPrevious={() => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
        {categories.isPending ? <p className="text-sm text-slate-500">Loading categories…</p> : null}
        {(categories.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No categories yet.</p> : null}
        <ul className="grid gap-2 md:grid-cols-2">
          {(categories.data ?? []).map((category) => (
            <li key={category.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">
                  {category.code} · {category.name}
                </p>
                <p className="text-slate-600">{parentLabel(category, categories.data ?? [])}</p>
              </div>
              <button
                type="button"
                className="text-red-700"
                onClick={() => setPendingCategory({ id: category.id, label: `${category.code} · ${category.name}` })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={pendingCategory !== null}
        title="Remove category?"
        description={
          <p>
            Soft-delete <span className="font-medium text-slate-900">{pendingCategory?.label}</span>? Products that used it keep
            their history.
          </p>
        }
        confirmLabel="Remove category"
        busy={removeCategory.isPending}
        onCancel={() => setPendingCategory(null)}
        onConfirm={() => {
          if (!pendingCategory) {
            return;
          }
          removeCategory.mutate(pendingCategory.id, {
            onSuccess: () => setPendingCategory(null),
          });
        }}
      />

      <Modal open={categoryOpen} title="New category" onClose={() => setCategoryOpen(false)}>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setCategoryError(null);
            try {
              await createCategory({
                code: String(form.get("code") ?? ""),
                name: String(form.get("name") ?? ""),
                description: String(form.get("description") ?? "") || undefined,
                parentId: String(form.get("parentId") ?? "") || undefined,
              });
              await queryClient.invalidateQueries({ queryKey: ["categories"] });
              setCategoryOpen(false);
            } catch (error) {
              setCategoryError(getApiErrorMessage(error));
            }
          }}
        >
          <FormField label="Code" htmlFor="code">
            <Input id="code" name="code" required maxLength={32} />
          </FormField>
          <FormField label="Name" htmlFor="name">
            <Input id="name" name="name" required maxLength={120} />
          </FormField>
          <FormField label="Parent" htmlFor="parentId">
            <select id="parentId" name="parentId" className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm">
              <option value="">None</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Description" htmlFor="description">
            <Input id="description" name="description" maxLength={500} />
          </FormField>
          {categoryError ? <p className="text-sm text-red-700">{categoryError}</p> : null}
          <Button type="submit">Create category</Button>
        </form>
      </Modal>
    </section>
  );

  function reset(setter: (value: string) => void, value: string) {
    setter(value);
    setCursors([undefined]);
  }
}

function parentLabel(category: Category, all: Category[]): string {
  if (!category.parentId) {
    return "Top level";
  }
  const parent = all.find((row) => row.id === category.parentId);
  return parent ? `Parent: ${parent.name}` : "Parent set";
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone: "slate" | "teal" | "amber" }) {
  const valueColor = tone === "teal" ? "text-teal-800" : tone === "amber" ? "text-amber-800" : "text-slate-950";
  return (
    <div className="flex min-h-[76px] flex-col justify-center px-4 py-3 first:pl-0 sm:pl-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}
