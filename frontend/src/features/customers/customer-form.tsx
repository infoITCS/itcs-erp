import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/forms/FormField.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  createCustomer,
  createCustomerAccountingCategory,
  createCustomerPaymentTerm,
  getCustomer,
  getCustomerFormOptions,
  updateCustomer,
  type CustomerCategory,
  type CustomerContactRole,
  type CustomerDetail,
  type CustomerPriority,
  type CustomerRating,
  type IdentityDocumentType,
  type IncorporationStatus,
  type CustomerLeadSource,
  type CustomerWrite,
  type PreferredCommunicationChannel,
  type PreferredPaymentMethod,
} from "./api.ts";

const customerTypes = ["B2B", "B2C", "WHOLESALE", "COMPANY", "INDIVIDUAL"] as const;
const entityTypes = ["COMPANY", "INDIVIDUAL"] as const;
const customerCategories = ["RETAIL", "WHOLESALE", "CORPORATE", "VIP", "PARTNER", "OTHER"] as const;
const customerRatings = ["HOT", "WARM", "COLD", "MISCELLANEOUS"] as const;
const customerPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const statuses = ["ACTIVE", "HOLD", "INACTIVE"] as const;
const incorporationStatuses = ["REGISTERED", "PENDING", "UNREGISTERED", "NOT_APPLICABLE"] as const;
const identityDocumentTypes = ["CNIC", "PASSPORT"] as const;
const paymentMethods = ["BANK_TRANSFER", "CASH", "CARD", "CHEQUE", "MOBILE_WALLET", "OTHER"] as const;
const communicationChannels = ["EMAIL", "PHONE", "SMS", "WHATSAPP"] as const;
const leadSources = ["WEBSITE", "REFERRAL", "COLD_CALL", "SOCIAL_MEDIA", "ADVERTISEMENT", "PARTNER", "TENDER", "OTHER"] as const;
const contactRoles = ["BILLING", "PROCUREMENT", "FINANCE", "OPERATIONS", "SALES", "OTHER"] as const;
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryCodes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
const countries = countryCodes
  .map((code) => ({ code, name: regionNames.of(code) ?? code }))
  .sort((left, right) => left.name.localeCompare(right.name));

const amount = z.string().trim().regex(/^\d{1,15}(\.\d{1,4})?$/, "Use a non-negative amount with up to four decimals");
const customPaymentTermSchema = z.object({
  name: z.string().trim().min(1, "Enter a payment term name").max(100),
  dueDays: z.number().int().min(0).max(3650),
  requiresPrepayment: z.boolean(),
});
const customAccountingCategorySchema = z.object({
  name: z.string().trim().min(1, "Enter an accounting category name").max(100),
  code: z.string().trim().regex(/^$|^[A-Za-z0-9_-]{2,32}$/, "Use 2-32 letters, numbers, dash or underscore"),
});
const openingAmount = z.string().trim().regex(/^-?\d{1,15}(\.\d{1,4})?$/, "Enter an amount with up to four decimals");
const employeeCountValue = z.string().regex(/^\d*$/, "Enter a whole number of employees");
const phoneNumber = z.string().trim().max(40).refine((value) => !value || (/^\+?[0-9(). -]{7,40}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7), "Enter a phone number with 7-40 digits or phone punctuation");
const taxNumberValue = z.string().trim().max(64).refine((value) => !value || /^[A-Za-z0-9][A-Za-z0-9./-]{1,63}$/.test(value), "Use 2-64 letters, numbers, dot, slash or dash");

const addressSchema = z.object({
  id: z.string().optional(),
  purpose: z.enum(["BILLING", "SHIPPING"]),
  isPrimary: z.boolean(),
  label: z.string().trim().max(80),
  line1: z.string().trim().min(1, "Street is required").max(200),
  line2: z.string().trim().max(200),
  city: z.string().trim().min(1, "City is required").max(120),
  region: z.string().trim().max(120),
  postalCode: z.string().trim().max(20),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  geofenceRadiusMeters: z.number().int().positive().optional(),
});

const contactSchema = z.object({
  id: z.string().optional(),
  role: z.enum(contactRoles).or(z.literal("")),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  jobTitle: z.string().trim().max(120),
  department: z.string().trim().max(120),
  phone: phoneNumber,
  mobile: phoneNumber,
  email: z.string().trim().max(320).refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email"),
  isPrimary: z.boolean(),
  emailOptIn: z.boolean(),
  phoneOptIn: z.boolean(),
  smsOptIn: z.boolean(),
  whatsappOptIn: z.boolean(),
  notes: z.string().trim().max(4000),
});

const formSchema = z.object({
  entityType: z.enum(entityTypes),
  customerType: z.enum(customerTypes),
  customerCategory: z.enum(customerCategories).or(z.literal("")),
  customerCode: z.string().trim().max(32),
  rating: z.enum(customerRatings).or(z.literal("")),
  priority: z.enum(customerPriorities),
  legalName: z.string().trim().max(200),
  displayName: z.string().trim().min(1, "Customer name is required").max(200),
  middleName: z.string().trim().max(100),
  industry: z.string().trim().max(120),
  employeeCount: employeeCountValue,
  incorporationStatus: z.enum(incorporationStatuses).or(z.literal("")),
  businessRegistrationDate: z.iso.date().or(z.literal("")),
  registrationNumber: z.string().trim().max(64),
  leadSource: z.enum(leadSources).or(z.literal("")),
  assignedSalesRepId: z.string(),
  status: z.enum(statuses),
  email: z.string().trim().max(320).refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email"),
  phone: z.string().trim().max(40),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a two-letter country code"),
  website: z.string().trim().max(200).refine((value) => !value || /^https?:\/\/\S+$/i.test(value), "Enter an http or https URL"),
  currencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code"),
  taxNumber: taxNumberValue,
  taxIdType: z.enum(["NTN", "STRN", "OTHER"]).or(z.literal("")),
  taxExemptionCode: z.string().trim().max(64).refine((value) => !value || /^[A-Za-z0-9][A-Za-z0-9/_-]{1,63}$/.test(value), "Use 2-64 letters, numbers, slash, dash or underscore"),
  defaultTaxCodeId: z.string(),
  identityDocumentType: z.enum(identityDocumentTypes).or(z.literal("")),
  identityDocumentNumber: z.string().trim().max(40),
  taxExempt: z.boolean(),
  pricesIncludeTax: z.boolean(),
  emailMarketingOptIn: z.boolean(),
  creditHold: z.boolean(),
  creditLimit: amount,
  preferredPaymentMethod: z.enum(paymentMethods).or(z.literal("")),
  preferredCommunicationChannel: z.enum(communicationChannels).or(z.literal("")),
  paymentTermId: z.string(),
  pricingGroupId: z.string(),
  accountingCategoryId: z.string(),
  sameAsBilling: z.boolean(),
  openingBalance: openingAmount,
  openingBalanceDate: z.string(),
  notes: z.string().trim().max(4000),
  addresses: z.array(addressSchema).max(20),
  contacts: z.array(contactSchema).max(100),
}).superRefine((values, context) => {
  if (values.entityType === "COMPANY" && !values.legalName) {
    context.addIssue({ code: "custom", message: "Legal company name is required", path: ["legalName"] });
  }
  const primaryByPurpose = new Set<string>();
  values.addresses.forEach((address, index) => {
    if (!address.isPrimary) return;
    if (primaryByPurpose.has(address.purpose)) {
      context.addIssue({ code: "custom", message: "Only one primary address per address type", path: ["addresses", index, "isPrimary"] });
    }
    primaryByPurpose.add(address.purpose);
  });
  if (values.contacts.filter((contact) => contact.isPrimary).length > 1) {
    context.addIssue({ code: "custom", message: "Select only one primary contact", path: ["contacts"] });
  }
  const documentNumber = values.identityDocumentNumber;
  if (values.entityType === "INDIVIDUAL" && Boolean(values.identityDocumentType) !== Boolean(documentNumber)) {
    context.addIssue({ code: "custom", message: "Provide both document type and number", path: [documentNumber ? "identityDocumentType" : "identityDocumentNumber"] });
  }
  if (documentNumber && values.identityDocumentType === "CNIC" && !/^(\d{13}|\d{5}-\d{7}-\d)$/.test(documentNumber)) {
    context.addIssue({ code: "custom", message: "Enter a 13-digit CNIC, optionally formatted with dashes", path: ["identityDocumentNumber"] });
  }
  if (documentNumber && values.identityDocumentType === "PASSPORT" && !/^[A-Za-z0-9]{5,20}$/.test(documentNumber)) {
    context.addIssue({ code: "custom", message: "Enter a passport number using 5-20 letters or numbers", path: ["identityDocumentNumber"] });
  }
  if (values.entityType === "COMPANY" && (values.identityDocumentType || documentNumber)) {
    context.addIssue({ code: "custom", message: "Identity documents are only for individual customers", path: ["identityDocumentNumber"] });
  }
  if (values.taxExempt && !values.taxExemptionCode) {
    context.addIssue({ code: "custom", message: "Enter an exemption code for tax-exempt customers", path: ["taxExemptionCode"] });
  }
});

type FormValues = z.infer<typeof formSchema>;
type FormTab = "basic" | "addresses" | "contacts" | "business" | "financials";

const tabs: Array<{ id: FormTab; label: string; number: string }> = [
  { id: "basic", label: "Basic info", number: "01" },
  { id: "addresses", label: "Addresses", number: "02" },
  { id: "contacts", label: "Contacts", number: "03" },
  { id: "business", label: "Business", number: "04" },
  { id: "financials", label: "Finance & tax", number: "05" },
];

const emptyValues: FormValues = {
  entityType: "COMPANY",
  customerType: "B2B",
  customerCategory: "CORPORATE",
  customerCode: "",
  rating: "",
  priority: "NORMAL",
  legalName: "",
  displayName: "",
  middleName: "",
  industry: "",
  employeeCount: "",
  incorporationStatus: "",
  businessRegistrationDate: "",
  registrationNumber: "",
  leadSource: "",
  assignedSalesRepId: "",
  status: "ACTIVE",
  email: "",
  phone: "",
  countryCode: "PK",
  website: "",
  currencyCode: "PKR",
  taxNumber: "",
  taxIdType: "",
  taxExemptionCode: "",
  defaultTaxCodeId: "",
  identityDocumentType: "",
  identityDocumentNumber: "",
  taxExempt: false,
  pricesIncludeTax: false,
  emailMarketingOptIn: false,
  creditHold: false,
  creditLimit: "0",
  preferredPaymentMethod: "",
  preferredCommunicationChannel: "",
  paymentTermId: "",
  pricingGroupId: "",
  accountingCategoryId: "",
  sameAsBilling: true,
  openingBalance: "0",
  openingBalanceDate: "",
  notes: "",
  addresses: [],
  contacts: [],
};

export default function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const draftKey = `customer-form-draft:${id ?? "new"}`;
  const [activeTab, setActiveTab] = useState<FormTab>("basic");
  const [draftMessage, setDraftMessage] = useState("");
  const [paymentTermModalOpen, setPaymentTermModalOpen] = useState(false);
  const [paymentTermName, setPaymentTermName] = useState("");
  const [paymentTermDays, setPaymentTermDays] = useState("0");
  const [paymentTermRequiresPrepayment, setPaymentTermRequiresPrepayment] = useState(false);
  const [paymentTermError, setPaymentTermError] = useState("");
  const [savingPaymentTerm, setSavingPaymentTerm] = useState(false);
  const [accountingCategoryModalOpen, setAccountingCategoryModalOpen] = useState(false);
  const [accountingCategoryName, setAccountingCategoryName] = useState("");
  const [accountingCategoryCode, setAccountingCategoryCode] = useState("");
  const [accountingCategoryError, setAccountingCategoryError] = useState("");
  const [savingAccountingCategory, setSavingAccountingCategory] = useState(false);
  const [draftValues] = useState<Partial<FormValues> | null>(() => readDraft(draftKey));
  const existing = useQuery({ queryKey: ["customers", id], queryFn: () => getCustomer(id as string), enabled: Boolean(id) });
  const options = useQuery({ queryKey: ["customers", "form-options"], queryFn: getCustomerFormOptions });
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...emptyValues, ...draftValues },
    mode: "onBlur",
  });
  const addresses = useFieldArray({ control: form.control, name: "addresses", keyName: "fieldKey" });
  const contacts = useFieldArray({ control: form.control, name: "contacts", keyName: "fieldKey" });
  const entityType = useWatch({ control: form.control, name: "entityType" });
  const sameAsBilling = useWatch({ control: form.control, name: "sameAsBilling" });

  useEffect(() => {
    if (!existing.data || draftValues) return;
    form.reset(toFormValues(existing.data));
  }, [draftValues, existing.data, form]);

  async function submit(values: FormValues) {
    form.clearErrors("root");
    try {
      const body = toWrite(values, Boolean(id));
      if (id) {
        await updateCustomer(id, body);
        sessionStorage.removeItem(draftKey);
        navigate(`/customers/${id}`);
        return;
      }
      const created = await createCustomer(body);
      sessionStorage.removeItem(draftKey);
      navigate(`/customers/${created.customer.id}`);
    } catch (error) {
      form.setError("root", { message: getApiErrorMessage(error) });
    }
  }

  function handleInvalid(errors: FieldErrors<FormValues>) {
    if (errors.addresses) setActiveTab("addresses");
    else if (errors.contacts) setActiveTab("contacts");
    else if (errors.employeeCount || errors.incorporationStatus || errors.businessRegistrationDate || errors.customerCategory || errors.leadSource || errors.registrationNumber || errors.rating || errors.priority) setActiveTab("business");
    else if (errors.creditLimit || errors.paymentTermId || errors.pricingGroupId || errors.accountingCategoryId || errors.openingBalance || errors.taxNumber || errors.taxExemptionCode || errors.defaultTaxCodeId) setActiveTab("financials");
    else setActiveTab("basic");
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(form.getValues()));
      setDraftMessage("Draft saved in this browser tab.");
    } catch {
      setDraftMessage("Draft could not be saved in this browser session.");
    }
  }

  function toggleSameAsBilling(checked: boolean) {
    form.setValue("sameAsBilling", checked, { shouldDirty: true });
    if (checked) {
      addresses.replace(form.getValues("addresses").filter((address) => address.purpose !== "SHIPPING"));
    }
  }

  async function savePaymentTerm() {
    setPaymentTermError("");
    const parsed = customPaymentTermSchema.safeParse({
      name: paymentTermName,
      dueDays: Number(paymentTermDays),
      requiresPrepayment: paymentTermRequiresPrepayment,
    });
    if (!parsed.success) {
      setPaymentTermError(parsed.error.issues[0]?.message ?? "Check the payment term details");
      return;
    }
    setSavingPaymentTerm(true);
    try {
      const term = await createCustomerPaymentTerm(parsed.data);
      await options.refetch();
      form.setValue("paymentTermId", term.id, { shouldDirty: true, shouldValidate: true });
      setPaymentTermModalOpen(false);
      setPaymentTermName("");
      setPaymentTermDays("0");
      setPaymentTermRequiresPrepayment(false);
    } catch (error) {
      setPaymentTermError(getApiErrorMessage(error));
    } finally {
      setSavingPaymentTerm(false);
    }
  }

  async function saveAccountingCategory() {
    setAccountingCategoryError("");
    const parsed = customAccountingCategorySchema.safeParse({
      name: accountingCategoryName,
      code: accountingCategoryCode.trim(),
    });
    if (!parsed.success) {
      setAccountingCategoryError(parsed.error.issues[0]?.message ?? "Check the accounting category details");
      return;
    }
    setSavingAccountingCategory(true);
    try {
      const category = await createCustomerAccountingCategory({ name: parsed.data.name, code: parsed.data.code || undefined });
      await options.refetch();
      form.setValue("accountingCategoryId", category.id, { shouldDirty: true, shouldValidate: true });
      setAccountingCategoryModalOpen(false);
      setAccountingCategoryName("");
      setAccountingCategoryCode("");
    } catch (error) {
      setAccountingCategoryError(getApiErrorMessage(error));
    } finally {
      setSavingAccountingCategory(false);
    }
  }

  const showForm = !id || Boolean(existing.data);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-teal-800"><span className="h-2 w-2 rounded-full bg-teal-600" />Customer workspace</p>
          <div>
            <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">{id ? "Edit customer" : "New customer"}</h1>
            <p className="mt-1 text-sm text-slate-600">Customer number is assigned automatically when submitted.</p>
          </div>
        </div>
        <Link to={id ? `/customers/${id}` : "/customers"} className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 sm:w-auto">
          Cancel
        </Link>
      </header>

      {id && existing.isPending ? <p className="py-8 text-sm text-slate-500">Loading customer details…</p> : null}
      {existing.isError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{getApiErrorMessage(existing.error)}</p> : null}
      {options.isError ? <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{getApiErrorMessage(options.error)} Sales reps, terms and tax groups may be unavailable.</p> : null}

      {showForm ? (
        <form noValidate onSubmit={form.handleSubmit(submit, handleInvalid)} className="flex flex-col gap-0 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div role="tablist" aria-label="Customer form sections" className="flex overflow-x-auto rounded-t-lg border-b border-slate-200 bg-slate-50 xl:grid xl:grid-cols-5 xl:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`customer-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`customer-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-14 shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-left text-sm transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 sm:gap-3 sm:px-4 xl:min-h-16 ${activeTab === tab.id ? "border-teal-700 bg-white font-semibold text-slate-950" : "border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900"}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 ${activeTab === tab.id ? "bg-teal-50 text-teal-800" : "bg-slate-200/70 text-slate-500"}`}>{tab.number}</span>
                <span className="whitespace-nowrap">{tab.label}</span>
                {tabHasErrors(tab.id, form.formState.errors) ? <span aria-label="Contains errors" className="ml-auto h-2 w-2 shrink-0 rounded-full bg-red-600" /> : null}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5 md:p-8">
            {activeTab === "basic" ? (
              <section role="tabpanel" id="customer-panel-basic" aria-labelledby="customer-tab-basic" className="flex flex-col gap-6">
                <SectionHeading title="Customer identity" description="Choose the account entity first. Fields adapt to company or individual registration." />
                <input type="hidden" {...form.register("entityType")} />
                <div className="grid max-w-xl grid-cols-2 rounded-md border border-slate-300 bg-slate-50 p-1" role="group" aria-label="Entity type">
                  {entityTypes.map((type) => (
                    <button key={type} type="button" aria-pressed={entityType === type} onClick={() => form.setValue("entityType", type, { shouldDirty: true })} className={`min-h-10 rounded px-3 text-sm font-medium transition-colors ${entityType === type ? "bg-teal-800 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}>
                      {type === "COMPANY" ? "Company" : "Individual"}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Customer / full name" htmlFor="displayName" error={form.formState.errors.displayName?.message}>
                    <Input id="displayName" autoComplete={entityType === "COMPANY" ? "organization" : "name"} {...form.register("displayName")} />
                  </FormField>
                  {entityType === "COMPANY" ? <FormField label="Registered legal name" htmlFor="legalName" error={form.formState.errors.legalName?.message}>
                    <Input id="legalName" autoComplete="organization" {...form.register("legalName")} />
                  </FormField> : null}
                  {entityType === "INDIVIDUAL" ? <FormField label="Middle name" htmlFor="middleName" error={form.formState.errors.middleName?.message}>
                    <Input id="middleName" autoComplete="additional-name" {...form.register("middleName")} />
                  </FormField> : null}
                  <FormField label="Customer segment" htmlFor="customerType" error={form.formState.errors.customerType?.message}>
                    <select id="customerType" className={selectClass} {...form.register("customerType")}>
                      <option value="B2B">B2B</option><option value="B2C">B2C</option><option value="WHOLESALE">Wholesale</option>
                      <option value="COMPANY">Company (legacy)</option><option value="INDIVIDUAL">Individual (legacy)</option>
                    </select>
                  </FormField>
                  <FormField label="Country" htmlFor="countryCode" error={form.formState.errors.countryCode?.message}>
                    <select id="countryCode" className={selectClass} {...form.register("countryCode")}>
                      {countries.map((country) => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}
                    </select>
                  </FormField>
                  <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
                    <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
                  </FormField>
                  <FormField label="Primary phone" htmlFor="phone" error={form.formState.errors.phone?.message}>
                    <Input id="phone" type="tel" autoComplete="tel" placeholder="+92 300 1234567" {...form.register("phone")} />
                  </FormField>
                  <FormField label="Website" htmlFor="website" error={form.formState.errors.website?.message}>
                    <Input id="website" type="url" placeholder="https://example.com" {...form.register("website")} />
                  </FormField>
                  <FormField label="Taxpayer ID type" htmlFor="taxIdType" error={form.formState.errors.taxIdType?.message}>
                    <select id="taxIdType" className={selectClass} {...form.register("taxIdType")}>
                      <option value="">Not provided</option><option value="NTN">NTN</option><option value="STRN">STRN</option><option value="OTHER">Other</option>
                    </select>
                  </FormField>
                  <FormField label="Taxpayer ID / NTN" htmlFor="taxNumber" error={form.formState.errors.taxNumber?.message}>
                    <Input id="taxNumber" autoComplete="off" {...form.register("taxNumber")} />
                  </FormField>
                  <FormField label="Account status" htmlFor="status" error={form.formState.errors.status?.message}>
                    <select id="status" className={selectClass} {...form.register("status")}>
                      <option value="ACTIVE">Active</option><option value="HOLD">On hold</option><option value="INACTIVE">Inactive</option>
                    </select>
                  </FormField>
                  {entityType === "INDIVIDUAL" ? (
                    <>
                      <FormField label="Identity document" htmlFor="identityDocumentType" error={form.formState.errors.identityDocumentType?.message}>
                        <select id="identityDocumentType" className={selectClass} {...form.register("identityDocumentType")}>
                          <option value="">Select document</option><option value="CNIC">CNIC</option><option value="PASSPORT">Passport</option>
                        </select>
                      </FormField>
                      <FormField label="CNIC / passport number" htmlFor="identityDocumentNumber" error={form.formState.errors.identityDocumentNumber?.message}>
                        <Input id="identityDocumentNumber" autoComplete="off" {...form.register("identityDocumentNumber")} />
                      </FormField>
                    </>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <div><p className="text-sm font-medium text-slate-800">Customer code</p><p className="mt-1 text-xs text-slate-500">Leave blank to auto-generate, or enter your own reference code.</p></div>
                  <div className="w-full max-w-xs">
                    <Input id="customerCode" autoComplete="off" placeholder="AUTO-GENERATED" {...form.register("customerCode")} />
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === "addresses" ? (
              <section role="tabpanel" id="customer-panel-addresses" aria-labelledby="customer-tab-addresses" className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeading title="Addresses" description="Set billing details and add a separate delivery location when needed." />
                  <Button type="button" variant="secondary" onClick={() => addresses.append(emptyAddress(sameAsBilling ? "BILLING" : "SHIPPING"))}>Add address</Button>
                </div>
                <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <input type="checkbox" className="mt-0.5 accent-teal-800" checked={sameAsBilling} onChange={(event) => toggleSameAsBilling(event.target.checked)} />
                  <span><span className="block font-medium text-slate-900">Delivery address is the same as billing</span><span className="mt-1 block text-xs text-slate-500">Turn this off to enter a separate ship-to address.</span></span>
                </label>
                {addresses.fields.length === 0 ? <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No addresses added.</p> : null}
                <div className="flex flex-col divide-y divide-slate-200">
                  {addresses.fields.map((field, index) => (
                    <div key={field.fieldKey} className="grid gap-4 py-5 first:pt-0 md:grid-cols-2">
                      <FormField label="Address purpose" htmlFor={`address-purpose-${index}`} error={form.formState.errors.addresses?.[index]?.purpose?.message}>
                        <select id={`address-purpose-${index}`} className={selectClass} {...form.register(`addresses.${index}.purpose`)}>
                          <option value="BILLING">Billing</option>{!sameAsBilling ? <option value="SHIPPING">Shipping / delivery</option> : null}
                        </select>
                      </FormField>
                      <FormField label="Label" htmlFor={`address-label-${index}`} error={form.formState.errors.addresses?.[index]?.label?.message}>
                        <Input id={`address-label-${index}`} placeholder="Head office, warehouse…" {...form.register(`addresses.${index}.label`)} />
                      </FormField>
                      <FormField label="Street address" htmlFor={`address-line1-${index}`} error={form.formState.errors.addresses?.[index]?.line1?.message}>
                        <Input id={`address-line1-${index}`} {...form.register(`addresses.${index}.line1`)} />
                      </FormField>
                      <FormField label="Address line 2" htmlFor={`address-line2-${index}`} error={form.formState.errors.addresses?.[index]?.line2?.message}>
                        <Input id={`address-line2-${index}`} {...form.register(`addresses.${index}.line2`)} />
                      </FormField>
                      <FormField label="City" htmlFor={`address-city-${index}`} error={form.formState.errors.addresses?.[index]?.city?.message}>
                        <Input id={`address-city-${index}`} {...form.register(`addresses.${index}.city`)} />
                      </FormField>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField label="State / region" htmlFor={`address-region-${index}`} error={form.formState.errors.addresses?.[index]?.region?.message}>
                          <Input id={`address-region-${index}`} {...form.register(`addresses.${index}.region`)} />
                        </FormField>
                        <FormField label="ZIP / postal code" htmlFor={`address-postal-${index}`} error={form.formState.errors.addresses?.[index]?.postalCode?.message}>
                          <Input id={`address-postal-${index}`} {...form.register(`addresses.${index}.postalCode`)} />
                        </FormField>
                      </div>
                      <FormField label="Country" htmlFor={`address-country-${index}`} error={form.formState.errors.addresses?.[index]?.countryCode?.message}>
                        <select id={`address-country-${index}`} className={selectClass} {...form.register(`addresses.${index}.countryCode`)}>
                          {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                        </select>
                      </FormField>
                      <div className="flex items-center justify-between gap-4">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" {...form.register(`addresses.${index}.isPrimary`)} />Primary for this address type
                        </label>
                        <button type="button" className="text-sm font-medium text-red-700 underline underline-offset-2" onClick={() => addresses.remove(index)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === "contacts" ? (
              <section role="tabpanel" id="customer-panel-contacts" aria-labelledby="customer-tab-contacts" className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeading title="Contact persons" description="Add primary and department contacts for this account." />
                  <Button type="button" variant="secondary" onClick={() => contacts.append(emptyContact())}>Add contact</Button>
                </div>
                {contacts.fields.length === 0 ? <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">No contacts added.</p> : null}
                <div className="flex flex-col divide-y divide-slate-200">
                  {contacts.fields.map((field, index) => (
                    <div key={field.fieldKey} className="grid gap-4 py-5 first:pt-0 md:grid-cols-2">
                      <FormField label="Contact role" htmlFor={`contact-role-${index}`} error={form.formState.errors.contacts?.[index]?.role?.message}>
                        <select id={`contact-role-${index}`} className={selectClass} {...form.register(`contacts.${index}.role`)}>
                          <option value="">Select role</option>
                          {contactRoles.map((role) => <option key={role} value={role}>{labelFor(role)}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Designation" htmlFor={`contact-title-${index}`} error={form.formState.errors.contacts?.[index]?.jobTitle?.message}>
                        <Input id={`contact-title-${index}`} {...form.register(`contacts.${index}.jobTitle`)} />
                      </FormField>
                      <FormField label="Department" htmlFor={`contact-department-${index}`} error={form.formState.errors.contacts?.[index]?.department?.message}>
                        <Input id={`contact-department-${index}`} placeholder="Finance, procurement…" {...form.register(`contacts.${index}.department`)} />
                      </FormField>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField label="First name" htmlFor={`contact-first-${index}`} error={form.formState.errors.contacts?.[index]?.firstName?.message}>
                          <Input id={`contact-first-${index}`} {...form.register(`contacts.${index}.firstName`)} />
                        </FormField>
                        <FormField label="Last name" htmlFor={`contact-last-${index}`} error={form.formState.errors.contacts?.[index]?.lastName?.message}>
                          <Input id={`contact-last-${index}`} {...form.register(`contacts.${index}.lastName`)} />
                        </FormField>
                      </div>
                      <FormField label="Direct phone" htmlFor={`contact-phone-${index}`} error={form.formState.errors.contacts?.[index]?.phone?.message}>
                        <Input id={`contact-phone-${index}`} type="tel" {...form.register(`contacts.${index}.phone`)} />
                      </FormField>
                      <FormField label="Mobile" htmlFor={`contact-mobile-${index}`} error={form.formState.errors.contacts?.[index]?.mobile?.message}>
                        <Input id={`contact-mobile-${index}`} type="tel" {...form.register(`contacts.${index}.mobile`)} />
                      </FormField>
                      <FormField label="Email" htmlFor={`contact-email-${index}`} error={form.formState.errors.contacts?.[index]?.email?.message}>
                        <Input id={`contact-email-${index}`} type="email" {...form.register(`contacts.${index}.email`)} />
                      </FormField>
                      <FormField label="Contact notes" htmlFor={`contact-notes-${index}`} error={form.formState.errors.contacts?.[index]?.notes?.message}>
                        <Input id={`contact-notes-${index}`} {...form.register(`contacts.${index}.notes`)} />
                      </FormField>
                      <div className="flex items-center justify-between gap-4 md:col-span-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="accent-teal-800" {...form.register(`contacts.${index}.isPrimary`)} />Primary contact
                        </label>
                        <button type="button" className="text-sm font-medium text-red-700 underline underline-offset-2" onClick={() => contacts.remove(index)}>Remove</button>
                      </div>
                      <fieldset className="md:col-span-2">
                        <legend className="text-xs font-medium uppercase text-slate-500">Communication consent</legend>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-slate-700 sm:grid-cols-4">
                          <label className="flex items-center gap-2"><input type="checkbox" className="accent-teal-800" {...form.register(`contacts.${index}.emailOptIn`)} />Email</label>
                          <label className="flex items-center gap-2"><input type="checkbox" className="accent-teal-800" {...form.register(`contacts.${index}.phoneOptIn`)} />Phone</label>
                          <label className="flex items-center gap-2"><input type="checkbox" className="accent-teal-800" {...form.register(`contacts.${index}.smsOptIn`)} />SMS</label>
                          <label className="flex items-center gap-2"><input type="checkbox" className="accent-teal-800" {...form.register(`contacts.${index}.whatsappOptIn`)} />WhatsApp</label>
                        </div>
                      </fieldset>
                    </div>
                  ))}
                </div>
                {form.formState.errors.contacts?.root?.message ? <p role="alert" className="text-sm text-red-700">{form.formState.errors.contacts.root.message}</p> : null}
              </section>
            ) : null}

            {activeTab === "business" ? (
              <section role="tabpanel" id="customer-panel-business" aria-labelledby="customer-tab-business" className="flex flex-col gap-5">
                <SectionHeading title="Business profile" description="Classification, registration, relationship origin and consent." />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Customer category" htmlFor="customerCategory" error={form.formState.errors.customerCategory?.message}>
                    <select id="customerCategory" className={selectClass} {...form.register("customerCategory")}>
                      <option value="">Unclassified</option>{customerCategories.map((category) => <option key={category} value={category}>{labelFor(category)}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Industry sector" htmlFor="industry" error={form.formState.errors.industry?.message}>
                    <Input id="industry" placeholder="Technology, distribution…" {...form.register("industry")} />
                  </FormField>
                  {entityType === "COMPANY" ? (
                    <>
                      <FormField label="Employee count" htmlFor="employeeCount" error={form.formState.errors.employeeCount?.message}>
                        <Input id="employeeCount" type="number" min="0" step="1" inputMode="numeric" {...form.register("employeeCount")} />
                      </FormField>
                      <FormField label="Incorporation status" htmlFor="incorporationStatus" error={form.formState.errors.incorporationStatus?.message}>
                        <select id="incorporationStatus" className={selectClass} {...form.register("incorporationStatus")}>
                          <option value="">Not provided</option>{incorporationStatuses.map((status) => <option key={status} value={status}>{labelFor(status)}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Business registration date" htmlFor="businessRegistrationDate" error={form.formState.errors.businessRegistrationDate?.message}>
                        <Input id="businessRegistrationDate" type="date" {...form.register("businessRegistrationDate")} />
                      </FormField>
                      <FormField label="Registration number (Siret / CRN)" htmlFor="registrationNumber" error={form.formState.errors.registrationNumber?.message}>
                        <Input id="registrationNumber" autoComplete="off" {...form.register("registrationNumber")} />
                      </FormField>
                    </>
                  ) : null}
                  <FormField label="Lead rating" htmlFor="rating" error={form.formState.errors.rating?.message}>
                    <select id="rating" className={selectClass} {...form.register("rating")}>
                      <option value="">Not rated</option>{customerRatings.map((rating) => <option key={rating} value={rating}>{labelFor(rating)}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Priority" htmlFor="priority" error={form.formState.errors.priority?.message}>
                    <select id="priority" className={selectClass} {...form.register("priority")}>
                      {customerPriorities.map((priority) => <option key={priority} value={priority}>{labelFor(priority)}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Lead source / referral origin" htmlFor="leadSource" error={form.formState.errors.leadSource?.message}>
                    <select id="leadSource" className={selectClass} {...form.register("leadSource")}>
                      <option value="">Not specified</option>{leadSources.map((source) => <option key={source} value={source}>{labelFor(source)}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Account owner" htmlFor="assignedSalesRepId" error={form.formState.errors.assignedSalesRepId?.message}>
                    <select id="assignedSalesRepId" className={selectClass} disabled={options.isPending} {...form.register("assignedSalesRepId")}>
                      <option value="">Unassigned</option>{options.data?.salesReps.map((rep) => <option key={rep.id} value={rep.id}>{rep.firstName} {rep.lastName}</option>)}
                    </select>
                  </FormField>
                </div>
                <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <input type="checkbox" className="mt-0.5 accent-teal-800" {...form.register("emailMarketingOptIn")} />
                  <span><span className="block font-medium text-slate-900">Email marketing consent</span><span className="mt-1 block text-xs text-slate-500">Record consent only when explicitly granted.</span></span>
                </label>
              </section>
            ) : null}

            {activeTab === "financials" ? (
              <section role="tabpanel" id="customer-panel-financials" aria-labelledby="customer-tab-financials" className="flex flex-col gap-6">
                <section className="flex flex-col gap-4">
                  <SectionHeading title="Commercial defaults" description="Currency, pricing, payment method and credit policy." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Currency" htmlFor="currencyCode" error={form.formState.errors.currencyCode?.message}>
                      <select id="currencyCode" className={selectClass} {...form.register("currencyCode")}>
                        <option value="PKR">PKR · Pakistani Rupee</option><option value="USD">USD · US Dollar</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · British Pound</option><option value="AED">AED · UAE Dirham</option>
                      </select>
                    </FormField>
                    <FormField label="Default payment terms" htmlFor="paymentTermId" error={form.formState.errors.paymentTermId?.message}>
                      <select
                        id="paymentTermId"
                        className={selectClass}
                        disabled={options.isPending}
                        {...form.register("paymentTermId")}
                        onChange={(event) => {
                          if (event.target.value === "__CREATE_PAYMENT_TERM__") {
                            event.target.value = form.getValues("paymentTermId");
                            setPaymentTermName("");
                            setPaymentTermDays("0");
                            setPaymentTermRequiresPrepayment(false);
                            setPaymentTermError("");
                            setPaymentTermModalOpen(true);
                            return;
                          }
                          void form.setValue("paymentTermId", event.target.value, { shouldDirty: true, shouldValidate: true });
                        }}
                      >
                        <option value="">No default terms</option>{options.data?.paymentTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                        <option value="__CREATE_PAYMENT_TERM__">Create a new...</option>
                      </select>
                    </FormField>
                    <FormField label="Price list / family" htmlFor="pricingGroupId" error={form.formState.errors.pricingGroupId?.message}>
                      <select id="pricingGroupId" className={selectClass} disabled={options.isPending} {...form.register("pricingGroupId")}>
                        <option value="">No default price family</option>{options.data?.pricingGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Accounting category" htmlFor="accountingCategoryId" error={form.formState.errors.accountingCategoryId?.message}>
                      <select
                        id="accountingCategoryId"
                        className={selectClass}
                        disabled={options.isPending}
                        {...form.register("accountingCategoryId")}
                        onChange={(event) => {
                          if (event.target.value === "__CREATE_ACCOUNTING_CATEGORY__") {
                            event.target.value = form.getValues("accountingCategoryId");
                            setAccountingCategoryName("");
                            setAccountingCategoryCode("");
                            setAccountingCategoryError("");
                            setAccountingCategoryModalOpen(true);
                            return;
                          }
                          void form.setValue("accountingCategoryId", event.target.value, { shouldDirty: true, shouldValidate: true });
                        }}
                      >
                        <option value="">Not specified</option>{options.data?.accountingCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        <option value="__CREATE_ACCOUNTING_CATEGORY__">Create a new...</option>
                      </select>
                    </FormField>
                    <FormField label="Preferred payment method" htmlFor="preferredPaymentMethod" error={form.formState.errors.preferredPaymentMethod?.message}>
                      <select id="preferredPaymentMethod" className={selectClass} {...form.register("preferredPaymentMethod")}>
                        <option value="">Not specified</option>{paymentMethods.map((method) => <option key={method} value={method}>{labelFor(method)}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Preferred communication" htmlFor="preferredCommunicationChannel" error={form.formState.errors.preferredCommunicationChannel?.message}>
                      <select id="preferredCommunicationChannel" className={selectClass} {...form.register("preferredCommunicationChannel")}>
                        <option value="">Not specified</option>{communicationChannels.map((channel) => <option key={channel} value={channel}>{labelFor(channel)}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Credit limit" htmlFor="creditLimit" error={form.formState.errors.creditLimit?.message}>
                      <Input id="creditLimit" inputMode="decimal" {...form.register("creditLimit")} />
                    </FormField>
                  </div>
                  <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <input type="checkbox" className="mt-0.5 accent-amber-800" {...form.register("creditHold")} />
                    <span><span className="block font-medium">Place account on credit hold</span><span className="mt-1 block text-xs text-amber-800">Prevent additional credit sales until reviewed.</span></span>
                  </label>
                </section>

                <section className="flex flex-col gap-4 border-t border-slate-200 pt-5">
                  <SectionHeading title="Tax setup" description="Select the default sales tax group or record a valid exemption." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Default sales tax group" htmlFor="defaultTaxCodeId" error={form.formState.errors.defaultTaxCodeId?.message}>
                      <select id="defaultTaxCodeId" className={selectClass} disabled={options.isPending} {...form.register("defaultTaxCodeId")}>
                        <option value="">Use organization default</option>{options.data?.taxCodes.map((taxCode) => <option key={taxCode.id} value={taxCode.id}>{taxCode.code} · {taxCode.name} ({taxCode.rate}%)</option>)}
                      </select>
                    </FormField>
                    <FormField label="Opening balance" htmlFor="openingBalance" error={form.formState.errors.openingBalance?.message}>
                      <Input id="openingBalance" inputMode="decimal" {...form.register("openingBalance")} />
                    </FormField>
                    <FormField label="Opening balance date" htmlFor="openingBalanceDate" error={form.formState.errors.openingBalanceDate?.message}>
                      <Input id="openingBalanceDate" type="date" {...form.register("openingBalanceDate")} />
                    </FormField>
                  </div>
                  <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <input type="checkbox" className="mt-0.5 accent-teal-800" {...form.register("taxExempt")} />
                    <span><span className="block font-medium text-slate-900">Tax exempt</span><span className="mt-1 block text-xs text-slate-500">An exemption code is required when this is enabled.</span></span>
                  </label>
                  {form.watch("taxExempt") ? <FormField label="Exemption code" htmlFor="taxExemptionCode" error={form.formState.errors.taxExemptionCode?.message}>
                    <Input id="taxExemptionCode" autoComplete="off" {...form.register("taxExemptionCode")} />
                  </FormField> : null}
                  <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <input type="checkbox" className="mt-0.5 accent-teal-800" {...form.register("pricesIncludeTax")} />
                    <span><span className="block font-medium text-slate-900">Product prices include tax</span><span className="mt-1 block text-xs text-slate-500">Enable when quoted line prices already include VAT.</span></span>
                  </label>
                </section>
                <FormField label="Internal notes and remarks" htmlFor="notes" error={form.formState.errors.notes?.message}>
                  <textarea id="notes" className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100" {...form.register("notes")} />
                </FormField>
              </section>
            ) : null}
          </div>

          {form.formState.errors.root?.message ? <p role="alert" className="mx-5 mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 md:mx-8">{form.formState.errors.root.message}</p> : null}
          <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-lg border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4 md:px-8">
            <div className="flex min-h-5 flex-1 items-center text-sm text-slate-500" aria-live="polite">{draftMessage || (form.formState.isDirty ? "Unsaved changes" : "")}</div>
            <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button type="button" variant="secondary" disabled={form.formState.isSubmitting} onClick={saveDraft} className="flex-1 sm:flex-none">Save as Draft</Button>
              <Button type="submit" disabled={form.formState.isSubmitting || (Boolean(id) && existing.isPending)} className="flex-1 bg-teal-800 hover:bg-teal-900 disabled:bg-slate-400 sm:flex-none">{form.formState.isSubmitting ? "Submitting…" : id ? "Save changes" : "Submit customer"}</Button>
            </div>
          </footer>
        </form>
      ) : null}
      <Modal open={paymentTermModalOpen} title="Create payment term" onClose={() => {
        if (!savingPaymentTerm) setPaymentTermModalOpen(false);
      }}>
        <div className="flex flex-col gap-4">
          <FormField label="Payment term name" htmlFor="new-payment-term-name">
            <Input id="new-payment-term-name" autoFocus maxLength={100} value={paymentTermName} onChange={(event) => setPaymentTermName(event.target.value)} placeholder="e.g. 25% advance, balance on delivery" />
          </FormField>
          <FormField label="Due after (days)" htmlFor="new-payment-term-days">
            <Input id="new-payment-term-days" type="number" min="0" max="3650" step="1" value={paymentTermDays} onChange={(event) => setPaymentTermDays(event.target.value)} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="accent-teal-800" checked={paymentTermRequiresPrepayment} onChange={(event) => setPaymentTermRequiresPrepayment(event.target.checked)} />Requires prepayment
          </label>
          {paymentTermError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{paymentTermError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={savingPaymentTerm} onClick={() => setPaymentTermModalOpen(false)}>Cancel</Button>
            <Button className="bg-teal-800 hover:bg-teal-900" disabled={savingPaymentTerm} onClick={() => void savePaymentTerm()}>{savingPaymentTerm ? "Creating…" : "Create payment term"}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={accountingCategoryModalOpen} title="Create accounting category" onClose={() => {
        if (!savingAccountingCategory) setAccountingCategoryModalOpen(false);
      }}>
        <div className="flex flex-col gap-4">
          <FormField label="Category name" htmlFor="new-accounting-category-name">
            <Input id="new-accounting-category-name" autoFocus maxLength={100} value={accountingCategoryName} onChange={(event) => setAccountingCategoryName(event.target.value)} placeholder="e.g. Local, Regional, Export" />
          </FormField>
          <FormField label="Code (optional)" htmlFor="new-accounting-category-code">
            <Input id="new-accounting-category-code" maxLength={32} value={accountingCategoryCode} onChange={(event) => setAccountingCategoryCode(event.target.value.toUpperCase())} placeholder="AUTO-GENERATED" />
          </FormField>
          {accountingCategoryError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{accountingCategoryError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={savingAccountingCategory} onClick={() => setAccountingCategoryModalOpen(false)}>Cancel</Button>
            <Button className="bg-teal-800 hover:bg-teal-900" disabled={savingAccountingCategory} onClick={() => void saveAccountingCategory()}>{savingAccountingCategory ? "Creating…" : "Create category"}</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="border-l-2 border-teal-700 pl-3"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></div>;
}

function emptyAddress(purpose: "BILLING" | "SHIPPING" = "BILLING") {
  return { purpose, isPrimary: false, label: "", line1: "", line2: "", city: "", region: "", postalCode: "", countryCode: "PK" };
}

function emptyContact() {
  return { role: "" as const, firstName: "", lastName: "", jobTitle: "", department: "", phone: "", mobile: "", email: "", isPrimary: false, emailOptIn: false, phoneOptIn: false, smsOptIn: false, whatsappOptIn: false, notes: "" };
}

function toFormValues(customer: CustomerDetail): FormValues {
  return {
    ...emptyValues,
    entityType: customer.entityType,
    customerType: customer.customerType,
    customerCategory: customer.customerCategory ?? "",
    customerCode: customer.customerCode ?? "",
    rating: customer.rating ?? "",
    priority: customer.priority,
    legalName: customer.legalName,
    displayName: customer.displayName,
    middleName: customer.middleName ?? "",
    industry: customer.industry ?? "",
    employeeCount: customer.employeeCount == null ? "" : String(customer.employeeCount),
    incorporationStatus: customer.incorporationStatus ?? "",
    businessRegistrationDate: customer.businessRegistrationDate?.slice(0, 10) ?? "",
    registrationNumber: customer.registrationNumber ?? "",
    leadSource: customer.leadSource ?? "",
    assignedSalesRepId: customer.assignedSalesRepId ?? "",
    status: customer.status,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    countryCode: customer.countryCode.trim(),
    website: customer.website ?? "",
    currencyCode: customer.currencyCode.trim(),
    taxNumber: customer.taxNumber ?? "",
    taxIdType: customer.taxIdType ?? "",
    taxExemptionCode: customer.taxExemptionCode ?? "",
    defaultTaxCodeId: customer.defaultTaxCodeId ?? "",
    identityDocumentType: customer.identityDocumentType ?? "",
    identityDocumentNumber: customer.identityDocumentNumber ?? "",
    taxExempt: customer.taxExempt,
    pricesIncludeTax: customer.pricesIncludeTax,
    emailMarketingOptIn: customer.emailMarketingOptIn,
    creditHold: customer.creditHold,
    creditLimit: customer.creditLimit,
    preferredPaymentMethod: customer.preferredPaymentMethod ?? "",
    preferredCommunicationChannel: customer.preferredCommunicationChannel ?? "",
    paymentTermId: customer.paymentTermId ?? "",
    pricingGroupId: customer.pricingGroupId ?? "",
    accountingCategoryId: customer.accountingCategoryId ?? "",
    sameAsBilling: customer.sameAsBilling,
    openingBalance: customer.openingBalance,
    openingBalanceDate: customer.openingBalanceDate?.slice(0, 10) ?? "",
    notes: customer.notes ?? "",
    addresses: customer.addresses.filter((address) => !customer.sameAsBilling || address.purpose !== "SHIPPING").map((address) => ({
      id: address.id,
      purpose: address.purpose,
      isPrimary: address.isPrimary,
      label: address.label ?? "",
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      region: address.region ?? "",
      postalCode: address.postalCode ?? "",
      countryCode: address.countryCode.trim(),
      latitude: address.latitude == null ? undefined : Number(address.latitude),
      longitude: address.longitude == null ? undefined : Number(address.longitude),
      geofenceRadiusMeters: address.geofenceRadiusMeters ?? undefined,
    })),
    contacts: customer.contacts.map((contact) => ({
      id: contact.id,
      role: contact.roleAssignments?.[0]?.role ?? "",
      firstName: contact.firstName,
      lastName: contact.lastName,
      jobTitle: contact.jobTitle ?? "",
      department: contact.department ?? "",
      phone: contact.phone ?? "",
      mobile: contact.mobile ?? "",
      email: contact.email ?? "",
      isPrimary: contact.isPrimary,
      emailOptIn: contact.emailOptIn,
      phoneOptIn: contact.phoneOptIn,
      smsOptIn: contact.smsOptIn,
      whatsappOptIn: contact.whatsappOptIn,
      notes: contact.notes ?? "",
    })),
  };
}

function toWrite(values: FormValues, editing: boolean): CustomerWrite {
  return {
    entityType: values.entityType,
    customerType: values.customerType,
    customerCategory: values.customerCategory ? values.customerCategory as CustomerCategory : editing ? null : undefined,
    customerCode: values.customerCode || (editing ? null : undefined),
    rating: values.rating ? values.rating as CustomerRating : editing ? null : undefined,
    priority: values.priority as CustomerPriority,
    industry: values.industry || (editing ? null : undefined),
    employeeCount: values.employeeCount ? Number(values.employeeCount) : editing ? null : undefined,
    incorporationStatus: values.incorporationStatus ? values.incorporationStatus as IncorporationStatus : editing ? null : undefined,
    businessRegistrationDate: values.businessRegistrationDate || (editing ? null : undefined),
    registrationNumber: values.registrationNumber || (editing ? null : undefined),
    leadSource: values.leadSource ? values.leadSource as CustomerLeadSource : editing ? null : undefined,
    assignedSalesRepId: values.assignedSalesRepId || (editing ? null : undefined),
    legalName: values.entityType === "INDIVIDUAL" ? values.displayName : values.legalName,
    displayName: values.displayName,
    middleName: values.entityType === "INDIVIDUAL" ? values.middleName || (editing ? null : undefined) : editing ? null : undefined,
    email: values.email || (editing ? null : undefined),
    phone: values.phone || (editing ? null : undefined),
    countryCode: values.countryCode.toUpperCase(),
    website: values.website || (editing ? null : undefined),
    currencyCode: values.currencyCode.toUpperCase(),
    taxNumber: values.taxNumber || (editing ? null : undefined),
    taxIdType: values.taxIdType || (editing ? null : undefined),
    taxExemptionCode: values.taxExempt ? values.taxExemptionCode : editing ? null : undefined,
    defaultTaxCodeId: values.defaultTaxCodeId || (editing ? null : undefined),
    identityDocumentType: values.entityType === "INDIVIDUAL" && values.identityDocumentType ? values.identityDocumentType as IdentityDocumentType : editing ? null : undefined,
    identityDocumentNumber: values.entityType === "INDIVIDUAL" ? values.identityDocumentNumber || (editing ? null : undefined) : editing ? null : undefined,
    taxExempt: values.taxExempt,
    pricesIncludeTax: values.pricesIncludeTax,
    emailMarketingOptIn: values.emailMarketingOptIn,
    creditHold: values.creditHold,
    status: values.status,
    creditLimit: values.creditLimit,
    preferredPaymentMethod: values.preferredPaymentMethod ? values.preferredPaymentMethod as PreferredPaymentMethod : editing ? null : undefined,
    preferredCommunicationChannel: values.preferredCommunicationChannel ? values.preferredCommunicationChannel as PreferredCommunicationChannel : editing ? null : undefined,
    paymentTermId: values.paymentTermId || (editing ? null : undefined),
    pricingGroupId: values.pricingGroupId || (editing ? null : undefined),
    accountingCategoryId: values.accountingCategoryId || (editing ? null : undefined),
    sameAsBilling: values.sameAsBilling,
    openingBalance: values.openingBalance,
    openingBalanceDate: values.openingBalanceDate || (editing ? null : undefined),
    notes: values.notes || (editing ? null : undefined),
    addresses: values.addresses.map((address) => ({
      ...address,
      countryCode: address.countryCode.toUpperCase(),
      label: address.label || undefined,
      line2: address.line2 || undefined,
      region: address.region || undefined,
      postalCode: address.postalCode || undefined,
    })),
    contacts: values.contacts.map((contact) => ({
      ...contact,
      role: contact.role ? contact.role as CustomerContactRole : undefined,
      firstName: contact.firstName.trim(),
      lastName: contact.lastName.trim(),
      jobTitle: contact.jobTitle || undefined,
      department: contact.department || undefined,
      email: contact.email || undefined,
      phone: contact.phone || undefined,
      mobile: contact.mobile || undefined,
      notes: contact.notes || undefined,
    })),
  };
}

function readDraft(key: string): Partial<FormValues> | null {
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? JSON.parse(saved) as Partial<FormValues> : null;
  } catch {
    return null;
  }
}

function tabHasErrors(tab: FormTab, errors: FieldErrors<FormValues>): boolean {
  if (tab === "basic") return Boolean(errors.entityType || errors.customerType || errors.legalName || errors.displayName || errors.middleName || errors.customerCode || errors.email || errors.phone || errors.countryCode || errors.website || errors.taxNumber || errors.identityDocumentType || errors.identityDocumentNumber);
  if (tab === "addresses") return Boolean(errors.addresses);
  if (tab === "contacts") return Boolean(errors.contacts);
  if (tab === "business") return Boolean(errors.customerCategory || errors.rating || errors.priority || errors.employeeCount || errors.incorporationStatus || errors.businessRegistrationDate || errors.registrationNumber || errors.leadSource || errors.assignedSalesRepId);
  return Boolean(errors.currencyCode || errors.taxExemptionCode || errors.defaultTaxCodeId || errors.creditLimit || errors.paymentTermId || errors.pricingGroupId || errors.accountingCategoryId || errors.openingBalance);
}

function labelFor(value: string): string {
  return value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

const selectClass = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
