import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createCategory,
  createPrice,
  createProduct,
  createTaxCode,
  createUnitOfMeasure,
  deletePrice,
  getProduct,
  getProductFormOptions,
  listCategories,
  listTaxCodes,
  listUnitsOfMeasure,
  updateProduct,
  type CategoryWrite,
  type DimensionUnit,
  type PriceType,
  type ProductFormOptions,
  type ProductPrice,
  type ProductType,
  type ProductWrite,
  type TaxCodeWrite,
  type UnitWrite,
} from "./api.ts";

const amountPattern = /^\d+(\.\d{1,4})?$/;
const numericFields = [
  "weightedAveragePrice",
  "minimumStockQuantity",
  "netWeight",
  "width",
  "length",
  "height",
  "salesPrice",
  "purchasePrice",
] as const;

const schema = z
  .object({
    code: z.string().trim().max(64),
    name: z.string().trim().min(1, "Enter a name").max(200),
    description: z.string().trim().max(4000),
    productType: z.enum(["PHYSICAL_PRODUCT", "SERVICE"]),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    categoryId: z.string(),
    unitOfMeasureId: z.string().uuid("Choose a unit"),
    taxCodeId: z.string(),
    trackInventory: z.boolean(),
    valuationMethod: z.enum(["WEIGHTED_AVERAGE", "FIFO"]),
    weightedAveragePrice: z.string().trim(),
    allowNegativeStock: z.boolean(),
    minimumStockQuantity: z.string().trim(),
    receivingLocation: z.string().trim().min(1, "Choose a receiving location"),
    deliveryLocation: z.string().trim().min(1, "Choose a picking location"),
    inventoryAccount: z.string().trim(),
    inventoryTransitAccount: z.string().trim(),
    privateNote: z.string().trim().max(4000),
    netWeight: z.string().trim(),
    width: z.string().trim(),
    length: z.string().trim(),
    height: z.string().trim(),
    dimensionUnit: z.enum(["METER", "CENTIMETER", "INCH", "FOOT"]),
    cogsAccount: z.string().trim().min(1, "Choose a COGS account"),
    incomeAccount: z.string().trim().min(1, "Choose an income account"),
    salesPrice: z.string().trim(),
    purchasePrice: z.string().trim(),
    priceCurrency: z.string().trim(),
    priceEffectiveDate: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    if (value.productType === "SERVICE" && value.trackInventory) {
      ctx.addIssue({ code: "custom", message: "A service cannot track inventory", path: ["trackInventory"] });
    }
    if (value.productType === "SERVICE" && value.allowNegativeStock) {
      ctx.addIssue({ code: "custom", message: "A service cannot authorize negative stock", path: ["allowNegativeStock"] });
    }
    for (const field of numericFields) {
      if (value[field] && !amountPattern.test(value[field])) {
        ctx.addIssue({ code: "custom", message: "Use up to 4 decimal places", path: [field] });
      }
    }
    if ((value.salesPrice || value.purchasePrice) && !/^[A-Za-z]{3}$/.test(value.priceCurrency)) {
      ctx.addIssue({ code: "custom", message: "Use a three-letter currency code", path: ["priceCurrency"] });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.priceEffectiveDate)) {
      ctx.addIssue({ code: "custom", message: "Choose an effective date", path: ["priceEffectiveDate"] });
    }
  });

type FormValues = z.infer<typeof schema>;
type AccountField = "inventoryAccount" | "inventoryTransitAccount" | "cogsAccount" | "incomeAccount";
type LocationField = "receivingLocation" | "deliveryLocation";

const fallbackOptions: ProductFormOptions = {
  locations: ["MAIN LOCATION"],
  accounts: [
    "12100 ( Inventory )",
    "12900 ( Inventory in Transit )",
    "COGS - Products (50110)",
    "COGS - Services (50140)",
    "Sales - Miscellaneous (40150)",
    "Sales - Services (40140)",
  ],
  valuationMethods: [
    { value: "WEIGHTED_AVERAGE", label: "Weighted average price" },
    { value: "FIFO", label: "First in, first out" },
  ],
  dimensionUnits: [
    { value: "METER", label: "Meter" },
    { value: "CENTIMETER", label: "Centimeter" },
    { value: "INCH", label: "Inch" },
    { value: "FOOT", label: "Foot" },
  ],
};

const empty: FormValues = {
  code: "",
  name: "",
  description: "",
  productType: "SERVICE",
  status: "ACTIVE",
  categoryId: "",
  unitOfMeasureId: "",
  taxCodeId: "",
  trackInventory: false,
  valuationMethod: "WEIGHTED_AVERAGE",
  weightedAveragePrice: "0.00",
  allowNegativeStock: false,
  minimumStockQuantity: "0.00",
  receivingLocation: "MAIN LOCATION",
  deliveryLocation: "MAIN LOCATION",
  inventoryAccount: "12100 ( Inventory )",
  inventoryTransitAccount: "12900 ( Inventory in Transit )",
  privateNote: "",
  netWeight: "0.00",
  width: "0.00",
  length: "0.00",
  height: "0.00",
  dimensionUnit: "METER",
  cogsAccount: "COGS - Services (50140)",
  incomeAccount: "Sales - Services (40140)",
  salesPrice: "0.00",
  purchasePrice: "0.00",
  priceCurrency: "PKR",
  priceEffectiveDate: new Date().toISOString().slice(0, 10),
};

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 transition focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";

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
  const formOptions = useQuery({ queryKey: ["product-form-options"], queryFn: getProductFormOptions });
  const options = formOptions.data ?? fallbackOptions;
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empty, mode: "onTouched" });
  const [familyOpen, setFamilyOpen] = useState(false);
  const [familyCode, setFamilyCode] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [savingFamily, setSavingFamily] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountField, setAccountField] = useState<AccountField>("incomeAccount");
  const [accountDraft, setAccountDraft] = useState("");
  const [customAccounts, setCustomAccounts] = useState<string[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationField, setLocationField] = useState<LocationField>("receivingLocation");
  const [locationDraft, setLocationDraft] = useState("");
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [optionOpen, setOptionOpen] = useState(false);
  const [optionKind, setOptionKind] = useState<"unit" | "tax">("unit");
  const [optionCode, setOptionCode] = useState("");
  const [optionName, setOptionName] = useState("");
  const [optionRate, setOptionRate] = useState("0.00");
  const [optionError, setOptionError] = useState<string | null>(null);
  const [savingOption, setSavingOption] = useState(false);
  const productType = form.watch("productType");
  const previewName = form.watch("name");
  const previewCode = form.watch("code");
  const previewSalesPrice = form.watch("salesPrice");
  const previewCurrency = form.watch("priceCurrency");
  const previewUnit = units.data?.find((unit) => unit.id === form.watch("unitOfMeasureId"))?.code ?? "Piece";
  const previewFamily = categories.data?.find((category) => category.id === form.watch("categoryId"))?.name ?? "Miscellaneous";

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const product = existing.data;
    form.reset({
      code: product.code,
      name: product.name,
      description: product.description ?? "",
      productType: product.productType,
      status: product.status,
      categoryId: product.categoryId ?? "",
      unitOfMeasureId: product.unitOfMeasureId,
      taxCodeId: product.taxCodeId ?? "",
      trackInventory: product.trackInventory,
      valuationMethod: product.valuationMethod,
      weightedAveragePrice: displayAmount(product.weightedAveragePrice),
      allowNegativeStock: product.allowNegativeStock,
      minimumStockQuantity: displayAmount(product.minimumStockQuantity),
      receivingLocation: product.receivingLocation,
      deliveryLocation: product.deliveryLocation,
      inventoryAccount: product.inventoryAccount ?? "",
      inventoryTransitAccount: product.inventoryTransitAccount ?? "",
      privateNote: product.privateNote ?? "",
      netWeight: displayAmount(product.netWeight),
      width: displayAmount(product.width),
      length: displayAmount(product.length),
      height: displayAmount(product.height),
      dimensionUnit: product.dimensionUnit,
      cogsAccount: product.cogsAccount,
      incomeAccount: product.incomeAccount,
      salesPrice: displayAmount(currentPriceOf(product.prices, "SALES")?.amount ?? "0"),
      purchasePrice: displayAmount(currentPriceOf(product.prices, "PURCHASE")?.amount ?? "0"),
      priceCurrency: "PKR",
      priceEffectiveDate: new Date().toISOString().slice(0, 10),
    });
  }, [existing.data, form]);

  useEffect(() => {
    if (id || form.getValues("unitOfMeasureId")) {
      return;
    }
    const preferredUnit = units.data?.find((unit) =>
      productType === "SERVICE" ? unit.code === "DAY" : unit.code === "EACH",
    );
    if (preferredUnit) {
      form.setValue("unitOfMeasureId", preferredUnit.id, { shouldDirty: true });
    }
  }, [id, productType, units.data, form]);

  function selectProductType(next: ProductType) {
    form.setValue("productType", next, { shouldDirty: true });
    if (id) {
      return;
    }
    const isService = next === "SERVICE";
    form.setValue("trackInventory", !isService, { shouldDirty: true });
    form.setValue("allowNegativeStock", false, { shouldDirty: true });
    form.setValue("incomeAccount", isService ? "Sales - Services (40140)" : "Sales - Miscellaneous (40150)", {
      shouldDirty: true,
    });
    form.setValue("cogsAccount", isService ? "COGS - Services (50140)" : "COGS - Products (50110)", {
      shouldDirty: true,
    });
    const preferredUnit = units.data?.find((unit) => (isService ? unit.code === "DAY" : unit.code === "EACH"));
    if (preferredUnit) {
      form.setValue("unitOfMeasureId", preferredUnit.id, { shouldDirty: true });
    }
  }

  function accountOptions(current: string): string[] {
    return [...new Set([...options.accounts, ...customAccounts, current].filter(Boolean))];
  }

  function selectAccount(field: AccountField, value: string) {
    if (value === "__create_account__") {
      setAccountField(field);
      setAccountDraft("");
      setAccountOpen(true);
      return;
    }
    form.setValue(field, value, { shouldDirty: true });
  }

  function locationOptions(current: string): string[] {
    return [...new Set([...options.locations, ...customLocations, current].map((value) => value.trim()).filter(Boolean))];
  }

  function selectLocation(field: LocationField, value: string) {
    if (value === "__create_location__") {
      setLocationField(field);
      setLocationDraft("");
      setLocationOpen(true);
      return;
    }
    form.setValue(field, value, { shouldDirty: true });
  }

  async function submitFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = familyCode.trim().toUpperCase();
    const name = familyName.trim();
    if (!code || !name) {
      setFamilyError("Enter a code and a family name");
      return;
    }
    setSavingFamily(true);
    setFamilyError(null);
    try {
      const body: CategoryWrite = { code, name, isActive: true };
      const created = await createCategory(body);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      form.setValue("categoryId", created.id, { shouldDirty: true });
      setFamilyOpen(false);
      setFamilyCode("");
      setFamilyName("");
    } catch (error) {
      setFamilyError(getApiErrorMessage(error));
    } finally {
      setSavingFamily(false);
    }
  }

  function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = accountDraft.trim();
    if (!value) {
      return;
    }
    setCustomAccounts((current) => [...new Set([...current, value])]);
    form.setValue(accountField, value, { shouldDirty: true });
    setAccountOpen(false);
    setAccountDraft("");
  }

  function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = locationDraft.trim().toUpperCase();
    if (!value) {
      return;
    }
    setCustomLocations((current) => [...new Set([...current, value])]);
    form.setValue(locationField, value, { shouldDirty: true });
    setLocationOpen(false);
    setLocationDraft("");
  }

  function openOption(kind: "unit" | "tax") {
    setOptionKind(kind);
    setOptionCode("");
    setOptionName("");
    setOptionRate("0.00");
    setOptionError(null);
    setOptionOpen(true);
  }

  async function submitOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = optionCode.trim().toUpperCase();
    const name = optionName.trim();
    if (!code || !name) {
      setOptionError("Enter a code and a name");
      return;
    }
    setSavingOption(true);
    setOptionError(null);
    try {
      if (optionKind === "unit") {
        const body: UnitWrite = { code, name, isActive: true };
        const created = await createUnitOfMeasure(body);
        await queryClient.invalidateQueries({ queryKey: ["units-of-measure"] });
        form.setValue("unitOfMeasureId", created.id, { shouldDirty: true });
      } else {
        const body: TaxCodeWrite = { code, name, rate: optionRate || "0.00", isActive: true };
        const created = await createTaxCode(body);
        await queryClient.invalidateQueries({ queryKey: ["tax-codes"] });
        form.setValue("taxCodeId", created.id, { shouldDirty: true });
      }
      setOptionOpen(false);
    } catch (error) {
      setOptionError(getApiErrorMessage(error));
    } finally {
      setSavingOption(false);
    }
  }

  async function submit(values: FormValues) {
    const body = toWrite(values, Boolean(id));
    try {
      if (id) {
        await updateProduct(id, body);
        const prices = existing.data?.prices ?? [];
        await syncPrice(id, "SALES", values.salesPrice, values.priceCurrency, values.priceEffectiveDate, prices);
        await syncPrice(id, "PURCHASE", values.purchasePrice, values.priceCurrency, values.priceEffectiveDate, prices);
        await queryClient.invalidateQueries({ queryKey: ["product-form-options"] });
        navigate(`/products/${id}`);
        return;
      }
      const created = await createProduct(body);
      await queryClient.invalidateQueries({ queryKey: ["product-form-options"] });
      navigate(`/products/${created.id}`);
    } catch (error) {
      form.setError("root", { message: getApiErrorMessage(error) });
    }
  }

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-brand-50/50 p-5 shadow-sm md:p-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
          <Link to="/products" className="transition hover:text-brand-800">
            Products and services
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-slate-700">{id ? "Edit" : "New"}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">New Product or Service</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Complete catalog, pricing, inventory, accounting, and advanced details for this item in one professional form.
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
            {id ? "Editing catalog item" : "Creating catalog item"}
          </span>
        </div>
      </header>

      {existing.isError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {getApiErrorMessage(existing.error)}
        </p>
      ) : null}
      {existing.isPending && id ? <p className="text-sm text-slate-500">Loading catalog item…</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form className="flex flex-col gap-5" noValidate onSubmit={form.handleSubmit(submit)}>
          <FormSection title="Item details" description="Identity, unit, pricing, and classification used across the ERP.">
            <div className="grid gap-4 lg:grid-cols-2">
              <TypeCard
                active={productType === "PHYSICAL_PRODUCT"}
                title="Product"
                description="Stockable goods with inventory, receiving, and costing."
                onClick={() => selectProductType("PHYSICAL_PRODUCT")}
              />
              <TypeCard
                active={productType === "SERVICE"}
                title="Service"
                description="Billable service with sales pricing and service income account."
                onClick={() => selectProductType("SERVICE")}
              />
            </div>
            <input type="hidden" {...form.register("productType")} />
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField label="Name" htmlFor="name" error={form.formState.errors.name?.message} required>
                <Input id="name" {...form.register("name")} placeholder="e.g. Managed firewall" />
              </FormField>
              <FormField label="Unit" htmlFor="unitOfMeasureId" error={form.formState.errors.unitOfMeasureId?.message} required>
                <select
                  id="unitOfMeasureId"
                  className={inputClass}
                  value={form.watch("unitOfMeasureId")}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__create_unit__") {
                      openOption("unit");
                      return;
                    }
                    form.setValue("unitOfMeasureId", value, { shouldDirty: true });
                  }}
                >
                  <option value="">Select unit</option>
                  {(units.data ?? []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code} · {unit.name}
                    </option>
                  ))}
                  <option value="__create_unit__">+ Create new unit</option>
                </select>
              </FormField>
              <FormField label="Sales Price" htmlFor="salesPrice" error={form.formState.errors.salesPrice?.message}>
                <Input id="salesPrice" {...form.register("salesPrice")} inputMode="decimal" />
              </FormField>
              <FormField label="Item Number" htmlFor="code" error={form.formState.errors.code?.message}>
                <Input id="code" {...form.register("code")} placeholder="Auto if blank" disabled={Boolean(id)} />
              </FormField>
              {productType === "PHYSICAL_PRODUCT" ? (
                <FormField label="Purchase Price" htmlFor="purchasePrice" error={form.formState.errors.purchasePrice?.message}>
                  <Input id="purchasePrice" {...form.register("purchasePrice")} inputMode="decimal" />
                </FormField>
              ) : null}
              <FormField label="Tax code" htmlFor="taxCodeId">
                <select
                  id="taxCodeId"
                  className={inputClass}
                  value={form.watch("taxCodeId")}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__create_tax__") {
                      openOption("tax");
                      return;
                    }
                    form.setValue("taxCodeId", value, { shouldDirty: true });
                  }}
                >
                  <option value="">No tax</option>
                  {(taxCodes.data ?? []).map((tax) => (
                    <option key={tax.id} value={tax.id}>
                      {tax.code} · {tax.rate}%
                    </option>
                  ))}
                  <option value="__create_tax__">+ Create new tax code</option>
                </select>
              </FormField>
            </div>
            <FormField label="Description" htmlFor="description" error={form.formState.errors.description?.message}>
              <textarea
                id="description"
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...form.register("description")}
              />
            </FormField>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField label="Family" htmlFor="categoryId">
                <select
                  id="categoryId"
                  className={inputClass}
                  value={form.watch("categoryId")}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__create_family__") {
                      setFamilyOpen(true);
                      return;
                    }
                    form.setValue("categoryId", value, { shouldDirty: true });
                  }}
                >
                  <option value="">Miscellaneous</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                  <option value="__create_family__">+ Create new family</option>
                </select>
              </FormField>
              <FormField label="Status" htmlFor="status" required>
                <select id="status" className={inputClass} {...form.register("status")}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Inventory and valuation"
            description={productType === "SERVICE" ? "Inventory controls are disabled for services." : "Stock, costing, and location defaults."}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <label
                className={`flex items-center gap-2 rounded-md border px-3 text-sm ${
                  productType === "SERVICE" ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-300 text-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  {...form.register("trackInventory")}
                  disabled={productType === "SERVICE"}
                  className="h-4 w-4"
                />
                Track Inventory
              </label>
              <FormField label="Valuation costing" htmlFor="valuationMethod">
                <select id="valuationMethod" className={inputClass} {...form.register("valuationMethod")}>
                  {options.valuationMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Weighted average price"
                htmlFor="weightedAveragePrice"
                error={form.formState.errors.weightedAveragePrice?.message}
              >
                <Input id="weightedAveragePrice" {...form.register("weightedAveragePrice")} inputMode="decimal" />
              </FormField>
              <FormField label="Authorize negative stock" htmlFor="allowNegativeStock">
                <select
                  id="allowNegativeStock"
                  className={inputClass}
                  {...form.register("allowNegativeStock", { setValueAs: (value) => value === "true" || value === true })}
                  disabled={productType === "SERVICE"}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </FormField>
              <FormField
                label="Minimum stock quantity"
                htmlFor="minimumStockQuantity"
                error={form.formState.errors.minimumStockQuantity?.message}
              >
                <Input id="minimumStockQuantity" {...form.register("minimumStockQuantity")} inputMode="decimal" />
              </FormField>
              <FormField label="Receiving Location" htmlFor="receivingLocation">
                <select
                  id="receivingLocation"
                  className={inputClass}
                  value={form.watch("receivingLocation")}
                  onChange={(event) => selectLocation("receivingLocation", event.target.value)}
                >
                  {locationOptions(form.watch("receivingLocation")).map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                  <option value="__create_location__">+ Create new location</option>
                </select>
              </FormField>
              <FormField label="Picking/Delivery Location" htmlFor="deliveryLocation">
                <select
                  id="deliveryLocation"
                  className={inputClass}
                  value={form.watch("deliveryLocation")}
                  onChange={(event) => selectLocation("deliveryLocation", event.target.value)}
                >
                  {locationOptions(form.watch("deliveryLocation")).map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                  <option value="__create_location__">+ Create new location</option>
                </select>
              </FormField>
              <FormField label="Inventory Account" htmlFor="inventoryAccount">
                <select
                  id="inventoryAccount"
                  className={inputClass}
                  value={form.watch("inventoryAccount")}
                  onChange={(event) => selectAccount("inventoryAccount", event.target.value)}
                >
                  <option value="">None</option>
                  {accountOptions(form.watch("inventoryAccount")).map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                  <option value="__create_account__">+ Create new account</option>
                </select>
              </FormField>
              <FormField label="Inventory Transit Account" htmlFor="inventoryTransitAccount">
                <select
                  id="inventoryTransitAccount"
                  className={inputClass}
                  value={form.watch("inventoryTransitAccount")}
                  onChange={(event) => selectAccount("inventoryTransitAccount", event.target.value)}
                >
                  <option value="">None</option>
                  {accountOptions(form.watch("inventoryTransitAccount")).map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                  <option value="__create_account__">+ Create new account</option>
                </select>
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Advanced" description="Private notes, dimensions, and posting accounts.">
            <FormField label="Private Note" htmlFor="privateNote">
              <textarea
                id="privateNote"
                className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...form.register("privateNote")}
              />
            </FormField>
            <div className="grid gap-4 lg:grid-cols-4">
              <FormField label="Net Weight" htmlFor="netWeight" error={form.formState.errors.netWeight?.message}>
                <Input id="netWeight" {...form.register("netWeight")} inputMode="decimal" />
              </FormField>
              <FormField label="Width" htmlFor="width" error={form.formState.errors.width?.message}>
                <Input id="width" {...form.register("width")} inputMode="decimal" />
              </FormField>
              <FormField label="Length" htmlFor="length" error={form.formState.errors.length?.message}>
                <Input id="length" {...form.register("length")} inputMode="decimal" />
              </FormField>
              <FormField label="Height" htmlFor="height" error={form.formState.errors.height?.message}>
                <Input id="height" {...form.register("height")} inputMode="decimal" />
              </FormField>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <FormField label="Dimension Unit" htmlFor="dimensionUnit">
                <select id="dimensionUnit" className={inputClass} {...form.register("dimensionUnit")}>
                  {options.dimensionUnits.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="COGS Account" htmlFor="cogsAccount" error={form.formState.errors.cogsAccount?.message} required>
                <select
                  id="cogsAccount"
                  className={inputClass}
                  value={form.watch("cogsAccount")}
                  onChange={(event) => selectAccount("cogsAccount", event.target.value)}
                >
                  {accountOptions(form.watch("cogsAccount")).map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                  <option value="__create_account__">+ Create new account</option>
                </select>
              </FormField>
              <FormField label="Income Account" htmlFor="incomeAccount" error={form.formState.errors.incomeAccount?.message} required>
                <select
                  id="incomeAccount"
                  className={inputClass}
                  value={form.watch("incomeAccount")}
                  onChange={(event) => selectAccount("incomeAccount", event.target.value)}
                >
                  {accountOptions(form.watch("incomeAccount")).map((account) => (
                    <option key={account} value={account}>
                      {account}
                    </option>
                  ))}
                  <option value="__create_account__">+ Create new account</option>
                </select>
              </FormField>
            </div>
          </FormSection>

          {form.formState.errors.root ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {id ? "Save changes" : "Create Product or Service"}
            </Button>
            <Link
              to={id ? `/products/${id}` : "/products"}
              className="inline-flex h-10 items-center px-3 text-sm font-medium text-slate-700 transition hover:text-slate-950"
            >
              Cancel
            </Link>
          </div>
        </form>

        <aside className="flex h-fit flex-col gap-5 xl:sticky xl:top-6">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Live summary</p>
            </div>
            <div className="p-4">
              <p className="font-mono text-xs text-slate-500">{previewCode || "PRD-YYYY-00001"}</p>
              <h2 className="mt-1 break-words text-lg font-semibold text-slate-950">{previewName || "New item"}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
                  {productType === "SERVICE" ? "Service" : "Product"}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{previewUnit}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{previewFamily}</span>
              </div>
              <dl className="mt-4 flex flex-col gap-2 text-sm">
                <SummaryRow label="Sales price" value={`${previewCurrency.toUpperCase() || "PKR"} ${previewSalesPrice || "0.00"}`} />
                <SummaryRow label="Valuation" value={options.valuationMethods.find((method) => method.value === form.watch("valuationMethod"))?.label ?? "Weighted average price"} />
                <SummaryRow label="COGS" value={form.watch("cogsAccount") || "—"} />
                <SummaryRow label="Income" value={form.watch("incomeAccount") || "—"} />
              </dl>
            </div>
          </section>

          <section className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Connected workflows</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
              <li>Sales price flows into quotes, sales orders, and invoices.</li>
              <li>Purchase price supports procurement costing.</li>
              <li>Inventory, accounts, and dimensions are stored on the catalog record.</li>
            </ul>
          </section>
        </aside>
      </div>

      <Modal open={familyOpen} title="Create new family" onClose={() => setFamilyOpen(false)}>
        <form className="flex flex-col gap-3" onSubmit={submitFamily}>
          <FormField label="Code" htmlFor="new-family-code" required>
            <Input
              id="new-family-code"
              value={familyCode}
              maxLength={32}
              onChange={(event) => setFamilyCode(event.target.value.toUpperCase())}
              placeholder="SUPPORT"
            />
          </FormField>
          <FormField label="Family name" htmlFor="new-family-name" required>
            <Input
              id="new-family-name"
              value={familyName}
              maxLength={120}
              onChange={(event) => {
                const value = event.target.value;
                setFamilyName(value);
                if (!familyCode) {
                  setFamilyCode(value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32));
                }
              }}
              placeholder="Support services"
            />
          </FormField>
          {familyError ? <p className="text-sm text-red-700">{familyError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={savingFamily}>
              {savingFamily ? "Creating…" : "Create family"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setFamilyOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={accountOpen}
        title={`Create ${accountField === "incomeAccount" ? "income" : "account"} option`}
        onClose={() => setAccountOpen(false)}
      >
        <form className="flex flex-col gap-3" onSubmit={submitAccount}>
          <p className="text-xs leading-relaxed text-slate-500">
            Custom account labels are saved with this catalog item and added to its account list.
          </p>
          <FormField label="Account" htmlFor="new-account" required>
            <Input
              id="new-account"
              value={accountDraft}
              maxLength={120}
              onChange={(event) => setAccountDraft(event.target.value)}
              placeholder="Sales - Support (40160)"
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit">Add account</Button>
            <Button type="button" variant="secondary" onClick={() => setAccountOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={locationOpen}
        title={`Create ${locationField === "receivingLocation" ? "receiving" : "picking/delivery"} location`}
        onClose={() => setLocationOpen(false)}
      >
        <form className="flex flex-col gap-3" onSubmit={submitLocation}>
          <p className="text-xs leading-relaxed text-slate-500">
            Custom locations are saved with this catalog item and added to both location lists.
          </p>
          <FormField label="Location" htmlFor="new-location" required>
            <Input
              id="new-location"
              value={locationDraft}
              maxLength={120}
              onChange={(event) => setLocationDraft(event.target.value)}
              placeholder="SITE B"
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit">Add location</Button>
            <Button type="button" variant="secondary" onClick={() => setLocationOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={optionOpen}
        title={optionKind === "unit" ? "Create new unit" : "Create new tax code"}
        onClose={() => setOptionOpen(false)}
      >
        <form className="flex flex-col gap-3" onSubmit={submitOption}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Code" htmlFor="new-option-code" required>
              <Input
                id="new-option-code"
                value={optionCode}
                maxLength={32}
                onChange={(event) => setOptionCode(event.target.value.toUpperCase())}
                placeholder={optionKind === "unit" ? "DAY" : "GST17"}
              />
            </FormField>
            <FormField label="Name" htmlFor="new-option-name" required>
              <Input
                id="new-option-name"
                value={optionName}
                maxLength={optionKind === "unit" ? 80 : 120}
                onChange={(event) => {
                  const value = event.target.value;
                  setOptionName(value);
                  if (!optionCode) {
                    setOptionCode(value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32));
                  }
                }}
                placeholder={optionKind === "unit" ? "Day" : "GST 17%"}
              />
            </FormField>
          </div>
          {optionKind === "tax" ? (
            <FormField label="Rate %" htmlFor="new-option-rate" required>
              <Input
                id="new-option-rate"
                value={optionRate}
                inputMode="decimal"
                onChange={(event) => setOptionRate(event.target.value)}
              />
            </FormField>
          ) : null}
          {optionError ? <p className="text-sm text-red-700">{optionError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={savingOption}>
              {savingOption ? "Creating…" : optionKind === "unit" ? "Create unit" : "Create tax code"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOptionOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

async function syncPrice(
  productId: string,
  priceType: PriceType,
  amount: string,
  currencyCode: string,
  effectiveDate: string,
  existingPrices: ProductPrice[],
) {
  const normalized = amount.trim();
  if (!normalized) {
    return;
  }
  const current = currentPriceOf(existingPrices, priceType);
  if (current && Number(current.amount) === Number(normalized) && current.currencyCode === currencyCode.toUpperCase()) {
    return;
  }
  if (current) {
    await deletePrice(current.id);
  }
  await createPrice(productId, {
    priceType,
    priceListCode: "STANDARD",
    currencyCode: currencyCode.toUpperCase(),
    amount: normalized,
    effectiveDate,
    isActive: true,
  });
}

function currentPriceOf(prices: ProductPrice[], priceType: PriceType): ProductPrice | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return prices.find(
    (price) =>
      price.priceType === priceType &&
      price.isActive &&
      price.priceListCode === "STANDARD" &&
      String(price.effectiveDate).slice(0, 10) <= today &&
      (!price.expiryDate || String(price.expiryDate).slice(0, 10) >= today),
  );
}

function displayAmount(value: string | number | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
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
    valuationMethod: values.valuationMethod,
    weightedAveragePrice: values.weightedAveragePrice || "0",
    allowNegativeStock: values.productType === "SERVICE" ? false : values.allowNegativeStock,
    minimumStockQuantity: values.minimumStockQuantity || "0",
    receivingLocation: values.receivingLocation,
    deliveryLocation: values.deliveryLocation,
    inventoryAccount: values.inventoryAccount || null,
    inventoryTransitAccount: values.inventoryTransitAccount || null,
    privateNote: values.privateNote || null,
    netWeight: values.netWeight || "0",
    width: values.width || "0",
    length: values.length || "0",
    height: values.height || "0",
    dimensionUnit: values.dimensionUnit as DimensionUnit,
    cogsAccount: values.cogsAccount,
    incomeAccount: values.incomeAccount,
    notes: values.privateNote || null,
  };
  if (values.code.trim()) {
    body.code = values.code.trim();
  }
  if (!isEdit) {
    body.initialSalesPrice = {
      priceType: "SALES",
      currencyCode: values.priceCurrency.trim().toUpperCase(),
      amount: values.salesPrice || "0",
      effectiveDate: values.priceEffectiveDate,
    };
    body.initialPurchasePrice = {
      priceType: "PURCHASE",
      currencyCode: values.priceCurrency.trim().toUpperCase(),
      amount: values.purchasePrice || "0",
      effectiveDate: values.priceEffectiveDate,
    };
  }
  return body;
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function TypeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${
        active ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 bg-white hover:border-brand-300"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <span className={`h-3 w-3 rounded-full ${active ? "bg-brand-700" : "bg-slate-300"}`} />
        {title}
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{description}</span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="max-w-[180px] break-words text-right font-medium text-slate-800" title={value}>
        {value}
      </dd>
    </div>
  );
}
