import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createProduct,
  getProduct,
  listCategories,
  listTaxCodes,
  listUnitsOfMeasure,
  updateProduct,
  type ProductWrite,
} from "./api.ts";

const schema = z
  .object({
    code: z.string().trim().max(64),
    name: z.string().trim().min(1, "Enter a name").max(200),
    description: z.string().trim().max(4000),
    productType: z.enum(["PHYSICAL_PRODUCT", "SERVICE"]),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    categoryId: z.string(),
    unitOfMeasureId: z.string().uuid("Choose a unit of measure"),
    taxCodeId: z.string(),
    trackInventory: z.boolean(),
    notes: z.string().trim().max(4000),
    priceAmount: z.string().trim(),
    priceCurrency: z.string().trim(),
    priceEffectiveDate: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    if (value.productType === "SERVICE" && value.trackInventory) {
      ctx.addIssue({ code: "custom", message: "A service cannot track inventory", path: ["trackInventory"] });
    }
  });

type FormValues = z.infer<typeof schema>;

const empty: FormValues = {
  code: "",
  name: "",
  description: "",
  productType: "PHYSICAL_PRODUCT",
  status: "ACTIVE",
  categoryId: "",
  unitOfMeasureId: "",
  taxCodeId: "",
  trackInventory: false,
  notes: "",
  priceAmount: "",
  priceCurrency: "PKR",
  priceEffectiveDate: new Date().toISOString().slice(0, 10),
};

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useQuery({
    queryKey: ["products", id],
    queryFn: () => getProduct(id as string),
    enabled: Boolean(id),
  });
  const units = useQuery({ queryKey: ["units-of-measure"], queryFn: listUnitsOfMeasure });
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const taxCodes = useQuery({ queryKey: ["tax-codes"], queryFn: listTaxCodes });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty });
  const productType = form.watch("productType");

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      code: existing.data.code,
      name: existing.data.name,
      description: existing.data.description ?? "",
      productType: existing.data.productType,
      status: existing.data.status,
      categoryId: existing.data.categoryId ?? "",
      unitOfMeasureId: existing.data.unitOfMeasureId,
      taxCodeId: existing.data.taxCodeId ?? "",
      trackInventory: existing.data.trackInventory,
      notes: existing.data.notes ?? "",
      priceAmount: "",
      priceCurrency: "PKR",
      priceEffectiveDate: new Date().toISOString().slice(0, 10),
    });
  }, [existing.data, form]);

  useEffect(() => {
    if (productType === "SERVICE") {
      form.setValue("trackInventory", false);
    }
  }, [productType, form]);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="border-b border-slate-200 pb-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-800">
          <span className="h-2 w-2 rounded-full bg-teal-600" />
          Supply / Catalog
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">{id ? "Edit product" : "New product"}</h1>
        <p className="mt-1 text-sm text-slate-600">Leave code blank to allocate PRD-year-00001 automatically.</p>
      </div>
      {existing.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(existing.error)}</p> : null}
      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          const body = toWrite(values, Boolean(id));
          try {
            if (id) {
              await updateProduct(id, body);
              navigate(`/products/${id}`);
              return;
            }
            const created = await createProduct(body);
            navigate(`/products/${created.id}`);
          } catch (error) {
            form.setError("root", { message: getApiErrorMessage(error) });
          }
        })}
      >
        <FormField label="Code" htmlFor="code" error={form.formState.errors.code?.message}>
          <Input id="code" {...form.register("code")} placeholder="Optional" disabled={Boolean(id)} />
        </FormField>
        <FormField label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
          <Input id="name" {...form.register("name")} />
        </FormField>
        <FormField label="Type" htmlFor="productType" error={form.formState.errors.productType?.message}>
          <select id="productType" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("productType")}>
            <option value="PHYSICAL_PRODUCT">Physical product</option>
            <option value="SERVICE">Service</option>
          </select>
        </FormField>
        <FormField label="Status" htmlFor="status" error={form.formState.errors.status?.message}>
          <select id="status" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("status")}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </FormField>
        <FormField label="Unit of measure" htmlFor="unitOfMeasureId" error={form.formState.errors.unitOfMeasureId?.message}>
          <select id="unitOfMeasureId" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("unitOfMeasureId")}>
            <option value="">Select UOM</option>
            {(units.data ?? []).map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} · {unit.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Category" htmlFor="categoryId">
          <select id="categoryId" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("categoryId")}>
            <option value="">None</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Tax code" htmlFor="taxCodeId">
          <select id="taxCodeId" className="h-9 rounded-md border border-slate-300 px-3 text-sm" {...form.register("taxCodeId")}>
            <option value="">None</option>
            {(taxCodes.data ?? []).map((tax) => (
              <option key={tax.id} value={tax.id}>
                {tax.code} · {tax.rate}%
              </option>
            ))}
          </select>
        </FormField>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" {...form.register("trackInventory")} disabled={productType === "SERVICE"} />
          Track inventory
        </label>
        {form.formState.errors.trackInventory ? (
          <p className="text-sm text-red-700">{form.formState.errors.trackInventory.message}</p>
        ) : null}
        <FormField label="Description" htmlFor="description">
          <textarea id="description" className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("description")} />
        </FormField>
        <FormField label="Notes" htmlFor="notes">
          <textarea id="notes" className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" {...form.register("notes")} />
        </FormField>

        {!id ? (
          <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">Optional initial sales price</legend>
            <FormField label="Amount" htmlFor="priceAmount">
              <Input id="priceAmount" {...form.register("priceAmount")} placeholder="1500.0000" />
            </FormField>
            <FormField label="Currency" htmlFor="priceCurrency">
              <Input id="priceCurrency" {...form.register("priceCurrency")} maxLength={3} />
            </FormField>
            <FormField label="Effective date" htmlFor="priceEffectiveDate">
              <Input id="priceEffectiveDate" type="date" {...form.register("priceEffectiveDate")} />
            </FormField>
          </fieldset>
        ) : null}

        {form.formState.errors.root ? <p className="text-sm text-red-700">{form.formState.errors.root.message}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {id ? "Save changes" : "Create product"}
          </Button>
          <Link to={id ? `/products/${id}` : "/products"} className="inline-flex h-9 items-center px-3 text-sm text-slate-700">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function toWrite(values: FormValues, isEdit: boolean): ProductWrite {
  const body: ProductWrite = {
    name: values.name,
    description: values.description || undefined,
    productType: values.productType,
    status: values.status,
    categoryId: values.categoryId || null,
    unitOfMeasureId: values.unitOfMeasureId,
    taxCodeId: values.taxCodeId || null,
    trackInventory: values.productType === "SERVICE" ? false : values.trackInventory,
    notes: values.notes || undefined,
  };
  if (!isEdit && values.code.trim()) {
    body.code = values.code.trim();
  }
  if (!isEdit && values.priceAmount.trim()) {
    body.initialSalesPrice = {
      priceType: "SALES",
      currencyCode: values.priceCurrency.trim().toUpperCase(),
      amount: values.priceAmount.trim(),
      effectiveDate: values.priceEffectiveDate,
    };
  }
  return body;
}
