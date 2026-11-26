import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/tables/DataTable.tsx";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { useDebouncedValue } from "@/hooks/useDebouncedValue.ts";
import { useHasPermission } from "@/hooks/useSession.ts";
import { queryKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createCategory,
  deleteCategory,
  listCategories,
  listProducts,
  updateCategory,
  type Category,
  type CategoryWrite,
  type ProductListParams,
  type ProductPrice,
  type ProductStatus,
  type ProductSummary,
  type ProductType,
} from "./api.ts";

const selectClassName =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 transition focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";

type MetricTone = "slate" | "brand" | "emerald" | "amber";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission("products:create");
  const canUpdate = useHasPermission("products:update");
  const canDelete = useHasPermission("products:delete");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProductStatus | "">("");
  const [productType, setProductType] = useState<ProductType | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [trackInventory, setTrackInventory] = useState("");
  const [sort, setSort] = useState<"createdAt" | "name" | "code">("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [pendingCategory, setPendingCategory] = useState<{ id: string; label: string } | null>(null);
  const debouncedQ = useDebouncedValue(q, 300);
  const cursor = cursors.at(-1);
  const params: ProductListParams = {
    q: debouncedQ || undefined,
    status: status || undefined,
    productType: productType || undefined,
    categoryId: categoryId || undefined,
    trackInventory: trackInventory ? trackInventory === "true" : undefined,
    sort,
    order,
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
      await invalidateCatalog(queryClient);
    },
  });

  const rows = products.data?.items ?? [];
  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = rows.filter((row) => row.status === "INACTIVE").length;
  const productCount = rows.filter((row) => row.productType === "PHYSICAL_PRODUCT").length;
  const serviceCount = rows.filter((row) => row.productType === "SERVICE").length;
  const categoryDialogOpen = categoryOpen || editingCategory !== null;

  function closeCategoryDialog() {
    setCategoryOpen(false);
    setEditingCategory(null);
    setCategoryError(null);
  }

  function reset<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setCursors([undefined]);
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parentId = String(form.get("parentId") ?? "") || undefined;
    const body: CategoryWrite = {
      code: String(form.get("code") ?? ""),
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      isActive: form.get("isActive") === "on",
    };
    if (editingCategory) {
      body.parentId = parentId || null;
    } else if (parentId) {
      body.parentId = parentId;
    }
    setCategoryError(null);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, body);
      } else {
        await createCategory(body);
      }
      await invalidateCatalog(queryClient);
      closeCategoryDialog();
    } catch (error) {
      setCategoryError(getApiErrorMessage(error));
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-brand-50/60 p-5 shadow-sm md:p-6">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              Supply / Catalog
            </p>
            <h1 className="text-3xl font-semibold text-slate-950">Products and services</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              One catalog for sellable products, billable services, pricing, and category structure. Active standard sales
              prices flow into quotes, sales orders, and invoices.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canCreate || canUpdate ? (
              <Button
                variant="secondary"
                className="h-10"
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryOpen(true);
                }}
              >
                Manage categories
              </Button>
            ) : null}
            {canCreate ? (
              <Link to="/products/new">
                <Button className="h-10 bg-brand-800 px-4 hover:bg-brand-900">Add catalog item</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section aria-label="Catalog overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="On this page" value={rows.length.toString()} tone="slate" hint="Loaded rows" />
        <MetricCard label="Active" value={activeCount.toString()} tone="emerald" hint="Ready to sell" />
        <MetricCard label="Inactive" value={inactiveCount.toString()} tone="slate" hint="Hidden from forms" />
        <MetricCard label="Products" value={productCount.toString()} tone="brand" hint="Physical items" />
        <MetricCard label="Services" value={serviceCount.toString()} tone="amber" hint="Billable work" />
      </section>

      <section
        aria-label="Product filters"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Refine catalog</h2>
            <p className="mt-0.5 text-xs text-slate-500">Filters update the list instantly.</p>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-brand-800 transition hover:text-brand-950"
            onClick={() => {
              reset(setQ, "");
              reset(setStatus, "");
              reset(setProductType, "");
              reset(setCategoryId, "");
              reset(setTrackInventory, "");
              reset(setSort, "createdAt");
              reset(setOrder, "desc");
            }}
          >
            Reset filters
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            className="h-10"
            value={q}
            placeholder="Search code or name"
            onChange={(event) => reset(setQ, event.target.value)}
          />
          <select className={selectClassName} value={status} onChange={(event) => reset(setStatus, event.target.value as ProductStatus | "")}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            className={selectClassName}
            value={productType}
            onChange={(event) => reset(setProductType, event.target.value as ProductType | "")}
          >
            <option value="">All item types</option>
            <option value="PHYSICAL_PRODUCT">Physical product</option>
            <option value="SERVICE">Service</option>
          </select>
          <select className={selectClassName} value={categoryId} onChange={(event) => reset(setCategoryId, event.target.value)}>
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select className={selectClassName} value={trackInventory} onChange={(event) => reset(setTrackInventory, event.target.value)}>
            <option value="">Any inventory policy</option>
            <option value="true">Inventory tracked</option>
            <option value="false">Non-stock item</option>
          </select>
          <select
            className={selectClassName}
            value={sort}
            onChange={(event) => reset(setSort, event.target.value as "createdAt" | "name" | "code")}
          >
            <option value="createdAt">Sort by newest</option>
            <option value="name">Sort by name</option>
            <option value="code">Sort by code</option>
          </select>
          <select className={selectClassName} value={order} onChange={(event) => reset(setOrder, event.target.value as "asc" | "desc")}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Catalog items</h2>
            <p className="mt-0.5 text-xs text-slate-500">Select an item to review pricing and connected workflows.</p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
            {rows.length}
          </span>
        </div>
        <div className="p-1">
          <DataTable
            columns={[
              {
                id: "code",
                header: "Code",
                cell: (row: ProductSummary) => <span className="font-mono text-xs text-slate-700">{row.code}</span>,
              },
              {
                id: "name",
                header: "Item",
                cell: (row: ProductSummary) => (
                  <div className="min-w-0">
                    <Link
                      className="font-semibold text-slate-950 underline-offset-4 hover:text-brand-800 hover:underline"
                      to={`/products/${row.id}`}
                    >
                      {row.name}
                    </Link>
                    {row.description ? (
                      <p className="mt-0.5 max-w-[320px] truncate text-xs text-slate-500">{row.description}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                id: "type",
                header: "Type",
                cell: (row: ProductSummary) => <TypePill type={row.productType} />,
              },
              {
                id: "category",
                header: "Category",
                cell: (row: ProductSummary) => row.category?.name ?? <span className="text-slate-400">Uncategorised</span>,
              },
              { id: "uom", header: "UOM", cell: (row: ProductSummary) => row.unitOfMeasure.code },
              {
                id: "inventory",
                header: "Inventory",
                cell: (row: ProductSummary) =>
                  row.trackInventory ? (
                    <span className="text-xs font-medium text-amber-800">Tracked</span>
                  ) : (
                    <span className="text-xs text-slate-500">Not tracked</span>
                  ),
              },
              {
                id: "price",
                header: "Standard sales price",
                cell: (row: ProductSummary) => <span className="tabular-nums">{formatProductPrice(row.prices?.[0])}</span>,
              },
              {
                id: "status",
                header: "Status",
                cell: (row: ProductSummary) => <StatusPill status={row.status} />,
              },
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
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Taxonomy</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-900">Category structure</h2>
          </div>
          {canCreate ? (
            <Button
              variant="secondary"
              className="h-9"
              onClick={() => {
                setEditingCategory(null);
                setCategoryOpen(true);
              }}
            >
              New category
            </Button>
          ) : null}
        </div>
        {categories.isPending ? <p className="p-4 text-sm text-slate-500">Loading categories…</p> : null}
        {(categories.data ?? []).length === 0 ? <p className="p-4 text-sm text-slate-500">No categories yet.</p> : null}
        <ul className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {(categories.data ?? []).map((category) => (
            <li key={category.id} className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200">
                      {category.code}
                    </span>
                    <span className="font-medium text-slate-900">{category.name}</span>
                    {category.isActive ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{parentLabel(category, categories.data ?? [])}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canUpdate ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-50"
                      onClick={() => {
                        setCategoryOpen(false);
                        setEditingCategory(category);
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                      onClick={() => setPendingCategory({ id: category.id, label: `${category.code} · ${category.name}` })}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
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

      <Modal open={categoryDialogOpen} title={editingCategory ? "Edit category" : "New category"} onClose={closeCategoryDialog}>
        <form key={editingCategory?.id ?? "new"} className="flex flex-col gap-3" onSubmit={submitCategory}>
          <FormField label="Code" htmlFor="category-code">
            <Input id="category-code" name="code" required maxLength={32} defaultValue={editingCategory?.code ?? ""} />
          </FormField>
          <FormField label="Name" htmlFor="category-name">
            <Input id="category-name" name="name" required maxLength={120} defaultValue={editingCategory?.name ?? ""} />
          </FormField>
          <FormField label="Parent" htmlFor="category-parent">
            <select
              id="category-parent"
              name="parentId"
              className={selectClassName}
              defaultValue={editingCategory?.parentId ?? ""}
            >
              <option value="">None — top level</option>
              {(categories.data ?? [])
                .filter((category) => category.id !== editingCategory?.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Description" htmlFor="category-description">
            <Input
              id="category-description"
              name="description"
              maxLength={500}
              defaultValue={editingCategory?.description ?? ""}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isActive" defaultChecked={editingCategory?.isActive ?? true} />
            Active category
          </label>
          {categoryError ? <p className="text-sm text-red-700">{categoryError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit">{editingCategory ? "Save category" : "Create category"}</Button>
            <Button type="button" variant="secondary" onClick={closeCategoryDialog}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

async function invalidateCatalog(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ["categories"] });
  await queryClient.invalidateQueries({ queryKey: ["products"] });
}

function parentLabel(category: Category, all: Category[]): string {
  if (!category.parentId) {
    return "Top level";
  }
  const parent = all.find((row) => row.id === category.parentId);
  return parent ? `Parent: ${parent.name}` : "Parent set";
}

function typeLabel(type: ProductType): string {
  return type === "SERVICE" ? "Service" : "Physical product";
}

function TypePill({ type }: { type: ProductType }) {
  const service = type === "SERVICE";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
        service ? "bg-violet-50 text-violet-800 ring-violet-200" : "bg-sky-50 text-sky-800 ring-sky-200"
      }`}
    >
      {typeLabel(type)}
    </span>
  );
}

function StatusPill({ status }: { status: ProductStatus }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
        active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function formatProductPrice(price?: ProductPrice | null): string {
  if (!price) {
    return "Not priced";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(price.amount));
  } catch {
    return `${price.amount} ${price.currencyCode}`;
  }
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: MetricTone;
}) {
  const accents: Record<MetricTone, string> = {
    slate: "text-slate-950",
    brand: "text-brand-800",
    emerald: "text-emerald-800",
    amber: "text-amber-800",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accents[tone]}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
