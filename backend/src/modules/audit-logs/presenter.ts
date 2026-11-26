import type { AuditListRow } from "./repository";

export interface AuditDisplayRef {
  label: string;
  detail?: string;
  email?: string;
  initials?: string;
}

export type AuditDisplayContext = Record<string, AuditDisplayRef>;

export interface AuditActorView {
  name: string;
  email: string | null;
  initials: string;
  isSystem: boolean;
}

export interface AuditActionView {
  key: string;
  label: string;
  headline: string;
  description: string;
  category: "create" | "update" | "status" | "delete" | "security" | "convert";
  tone: "emerald" | "blue" | "amber" | "rose" | "violet" | "slate";
  icon: string;
}

export interface AuditSubjectView {
  type: string;
  typeLabel: string;
  label: string;
  detail: string | null;
}

export interface AuditChangeView {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface AuditFactView {
  label: string;
  value: string;
}

export interface AuditLogEntryView {
  id: string;
  createdAt: string;
  actor: AuditActorView;
  action: AuditActionView;
  module: { key: string; label: string };
  subject: AuditSubjectView;
  changes: AuditChangeView[];
  facts: AuditFactView[];
  tags: string[];
  searchText: string;
  ipAddress: string | null;
  userAgent: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})/;

const ENTITY_LABELS: Record<string, string> = {
  user: "User",
  organization: "Organization",
  role: "Role",
  contact: "Contact",
  customer: "Customer",
  customer_address: "Customer address",
  payment_term: "Payment term",
  accounting_category: "Accounting category",
  "exchange-rate": "Exchange rate",
  lead: "Lead",
  opportunity: "Opportunity",
  opportunity_product_interest: "Product interest",
  product: "Product",
  product_price: "Product price",
  product_category: "Product category",
  quote: "Quote",
  "sales-order": "Sales order",
  invoice: "Invoice",
  payment: "Payment",
  project: "Project",
  tender: "Tender",
  reseller: "Reseller",
  reseller_address: "Reseller address",
  reseller_contact: "Reseller contact",
};

const MODULE_LABELS: Record<string, string> = {
  auth: "Security",
  contacts: "Contacts",
  customers: "Customers",
  currencies: "Currencies",
  invoices: "Invoices",
  leads: "Leads",
  opportunities: "Opportunities",
  organizations: "Organization",
  payments: "Payments",
  products: "Products",
  profile: "Profile",
  projects: "Projects",
  quotes: "Quotes",
  resellers: "Resellers",
  roles: "Roles & access",
  "sales-orders": "Sales orders",
  tenders: "Tenders",
  users: "Users & access",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  title: "Title",
  displayName: "Display name",
  legalName: "Legal name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  status: "Status",
  stage: "Stage",
  probabilityPercent: "Probability",
  estimatedValue: "Estimated value",
  amount: "Amount",
  total: "Total",
  amountPaid: "Amount paid",
  currencyCode: "Currency",
  code: "Code",
  customerNumber: "Customer number",
  quoteNumber: "Quote number",
  salesOrderNumber: "Sales order number",
  invoiceNumber: "Invoice number",
  paymentNumber: "Payment number",
  projectNumber: "Project number",
  tenderNumber: "Tender number",
  leadNumber: "Lead number",
  opportunityNumber: "Opportunity number",
  resellerNumber: "Reseller number",
  productCode: "Product code",
  priceListCode: "Price list",
  referenceNumber: "Reference",
  method: "Payment method",
  source: "Source",
  leadSource: "Lead source",
  mode: "Mode",
  purpose: "Purpose",
  line1: "Address",
  city: "City",
  dueDays: "Due days",
  isPrimary: "Primary",
  isActive: "Active",
  requiresPrepayment: "Prepayment required",
  taxCodeId: "Tax code",
  description: "Description",
  notes: "Notes",
  roleCodes: "Roles",
  permissions: "Permissions",
  lostReason: "Lost reason",
  passwordChanged: "Password changed",
  avatarUpdated: "Avatar updated",
  hadAvatar: "Avatar present",
  locked: "Account locked",
  archived: "Archived",
  effectiveDate: "Effective date",
  expiryDate: "Expiry date",
  quantity: "Quantity",
  estimatedUnitAmount: "Unit amount",
  defaultDiscountPercent: "Default discount",
  defaultCommissionPercent: "Default commission",
  jobTitle: "Job title",
  department: "Department",
  location: "Location",
  bio: "Bio",
  website: "Website",
  countryCode: "Country",
  baseCurrencyCode: "Base currency",
  quoteCurrencyCode: "Quote currency",
  rate: "Rate",
  refunded: "Refunded",
};

const FACT_PRIORITY: string[] = [
  "opportunityNumber",
  "salesOrderNumber",
  "invoiceNumber",
  "quoteNumber",
  "tenderNumber",
  "leadNumber",
  "projectNumber",
  "paymentNumber",
  "customerNumber",
  "resellerNumber",
  "displayName",
  "title",
  "name",
  "productCode",
  "code",
  "email",
  "status",
  "stage",
  "probabilityPercent",
  "estimatedValue",
  "total",
  "amount",
  "amountPaid",
  "currencyCode",
  "method",
  "mode",
  "source",
  "leadSource",
  "lostReason",
  "priceListCode",
  "purpose",
  "roleCodes",
  "permissions",
  "passwordChanged",
  "avatarUpdated",
  "locked",
  "archived",
  "dueDays",
  "effectiveDate",
  "expiryDate",
];

const ID_FIELD_TYPES: Record<string, string> = {
  userId: "user",
  targetUserId: "user",
  actorId: "user",
  customerId: "customer",
  createdFromCustomerId: "customer",
  contactId: "contact",
  previousContactId: "contact",
  productId: "product",
  categoryId: "product_category",
  parentId: "product_category",
  resellerId: "reseller",
  leadId: "lead",
  createdFromLeadId: "lead",
  opportunityId: "opportunity",
  createdFromOpportunityId: "opportunity",
  quoteId: "quote",
  salesOrderId: "sales-order",
  invoiceId: "invoice",
  paymentId: "payment",
  projectId: "project",
  tenderId: "tender",
  customerAddressId: "customer_address",
  resellerAddressId: "reseller_address",
  resellerContactId: "reseller_contact",
};

export function displayKey(type: string, id: string): string {
  return `${type}:${id}`;
}

export function idFieldType(field: string): string | null {
  return ID_FIELD_TYPES[field] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function splitWords(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return splitWords(value)
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function actionTitleCase(value: string): string {
  const small = new Set(["a", "an", "and", "as", "by", "for", "from", "into", "of", "on", "the", "to", "with"]);
  return titleCase(value)
    .split(" ")
    .map((part, index) => (index > 0 && small.has(part.toLowerCase()) ? part.toLowerCase() : part))
    .join(" ");
}

function sentenceCase(value: string): string {
  const label = titleCase(value);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? titleCase(key);
}

function entityLabel(type: string): string {
  return ENTITY_LABELS[type] ?? titleCase(type || "Record");
}

function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? titleCase(key || "System");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatName(value: string): string {
  if (UUID_PATTERN.test(value)) {
    return "";
  }
  return value;
}

function resolveRef(value: unknown, field: string, context: AuditDisplayContext): AuditDisplayRef | null {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return null;
  }
  const type = ID_FIELD_TYPES[field];
  if (!type) {
    return null;
  }
  return context[displayKey(type, value)] ?? null;
}

function formatValue(value: unknown, field: string, context: AuditDisplayContext): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    const values = value
      .map((item) => formatValue(item, field, context))
      .filter((item): item is string => Boolean(item));
    if (values.length === 0) {
      return null;
    }
    return values.length > 3 ? `${values.slice(0, 3).join(", ")} +${values.length - 3} more` : values.join(", ");
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value !== "string") {
    return null;
  }
  const ref = resolveRef(value, field, context);
  if (ref) {
    return ref.label;
  }
  if (UUID_PATTERN.test(value)) {
    return null;
  }
  if (ISO_DATE_PATTERN.test(value)) {
    return formatDate(value);
  }
  if (
    field === "status" ||
    field === "stage" ||
    field === "mode" ||
    field === "source" ||
    field === "leadSource" ||
    field === "purpose" ||
    field === "roleCodes"
  ) {
    return titleCase(value);
  }
  if (field === "currencyCode" || field === "baseCurrencyCode" || field === "quoteCurrencyCode") {
    return value.toUpperCase();
  }
  return formatName(value) || null;
}

function buildChanges(
  oldValues: unknown,
  newValues: unknown,
  context: AuditDisplayContext,
  action: string,
): AuditChangeView[] {
  const before = asRecord(oldValues);
  const after = asRecord(newValues);
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changes: AuditChangeView[] = [];
  const isRemoval = action.includes("deleted") || action.includes("removed");

  for (const key of keys) {
    if (key.endsWith("Id") || key === "changes" || key === "fields" || key === "organizationId") {
      continue;
    }
    const hasAfter = key in after;
    if (!hasAfter && !isRemoval) {
      continue;
    }
    const beforeValue = formatValue(before[key], key, context) ?? "—";
    const afterValue = hasAfter ? formatValue(after[key], key, context) ?? "—" : "Removed";
    if (beforeValue === afterValue && key !== "status" && key !== "stage") {
      continue;
    }
    changes.push({ key, label: fieldLabel(key), before: beforeValue, after: afterValue });
  }
  return changes;
}

function buildFacts(
  oldValues: unknown,
  newValues: unknown,
  context: AuditDisplayContext,
): AuditFactView[] {
  const before = asRecord(oldValues);
  const after = asRecord(newValues);
  const merged = { ...before, ...after };
  const facts: AuditFactView[] = [];

  for (const key of FACT_PRIORITY) {
    if (!(key in merged)) {
      continue;
    }
    const value = formatValue(merged[key], key, context);
    if (value) {
      facts.push({ label: fieldLabel(key), value });
    }
  }

  for (const key of ["changes", "fields"]) {
    const raw = merged[key];
    if (Array.isArray(raw)) {
      const labels = raw
        .filter((item): item is string => typeof item === "string")
        .map(fieldLabel);
      if (labels.length > 0) {
        facts.push({
          label: "Fields touched",
          value: labels.length > 4 ? `${labels.slice(0, 4).join(", ")} +${labels.length - 4}` : labels.join(", "),
        });
      }
      continue;
    }
    const nested = asRecord(raw);
    for (const [nestedKey, nestedValue] of Object.entries(nested)) {
      if (nestedKey.endsWith("Id")) {
        continue;
      }
      const value = formatValue(nestedValue, nestedKey, context);
      if (value) {
        facts.push({ label: fieldLabel(nestedKey), value });
      }
    }
  }

  return facts;
}

function buildActor(row: AuditListRow, context: AuditDisplayContext): AuditActorView {
  const resolved = row.userId ? context[displayKey("user", row.userId)] : null;
  const payloadEmail = text(asRecord(row.newValues).email) ?? text(asRecord(row.oldValues).email);
  if (resolved) {
    const name = resolved.label || payloadEmail || "Unknown user";
    return {
      name,
      email: resolved.email ?? payloadEmail,
      initials: resolved.initials ?? initialsFrom(name),
      isSystem: false,
    };
  }
  if (payloadEmail) {
    const name = nameFromEmail(payloadEmail);
    return { name, email: payloadEmail, initials: initialsFrom(name), isSystem: false };
  }
  return { name: "System", email: null, initials: "SY", isSystem: true };
}

function initialsFrom(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  return titleCase(local.replace(/[._-]+/g, " "));
}

function subjectFromPayload(row: AuditListRow, context: AuditDisplayContext): AuditDisplayRef | null {
  const values = { ...asRecord(row.oldValues), ...asRecord(row.newValues) };
  const numberKeys = [
    "tenderNumber",
    "projectNumber",
    "leadNumber",
    "opportunityNumber",
    "quoteNumber",
    "salesOrderNumber",
    "invoiceNumber",
    "paymentNumber",
    "customerNumber",
    "resellerNumber",
  ];
  const nameKeys = ["displayName", "title", "name", "email", "purpose", "label"];

  const numberKey = numberKeys.find((key) => typeof values[key] === "string" && values[key]);
  const nameKey = nameKeys.find((key) => typeof values[key] === "string" && values[key]);
  if (!numberKey && !nameKey) {
    const idKey = Object.keys(values).find((key) => key.endsWith("Id") && ID_FIELD_TYPES[key]);
    if (idKey) {
      const ref = resolveRef(values[idKey], idKey, context);
      if (ref) {
        return ref;
      }
    }
    return null;
  }

  const number = numberKey ? String(values[numberKey]) : "";
  const name = nameKey ? String(values[nameKey]) : "";
  const detail = number && name && number !== name ? `${number} · ${name}` : number || name;
  return { label: detail || entityLabel(row.entityType), detail: undefined };
}

function buildSubject(row: AuditListRow, context: AuditDisplayContext): AuditSubjectView {
  const resolved = row.entityId ? context[displayKey(row.entityType, row.entityId)] : null;
  const payload = subjectFromPayload(row, context);
  const label = resolved?.label || payload?.label || `${entityLabel(row.entityType)} record`;
  return {
    type: row.entityType,
    typeLabel: entityLabel(row.entityType),
    label,
    detail: resolved?.detail ?? payload?.detail ?? null,
  };
}

function actionLabel(action: string): string {
  const parts = action.split(".");
  const core = parts.length > 1 ? parts.slice(1).join(" ") : action;
  const fixes: Record<string, string> = {
    "Converted to Opportunity": "Converted to opportunity",
    "Login Succeeded": "Signed in",
    "Login Failed": "Sign-in failed",
    "Microsoft Login Succeeded": "Signed in with Microsoft",
    "Password Reset Requested": "Password reset requested",
    "Password Reset Completed": "Password reset completed",
    "Access Removed": "Access revoked",
    "Primary Changed": "Primary contact changed",
  };
  return fixes[actionTitleCase(core)] ?? actionTitleCase(core);
}

function categoryFor(action: string): AuditActionView["category"] {
  if (action.startsWith("auth") || action.includes("password") || action.includes("access")) {
    return "security";
  }
  if (action.includes("converted") || action.includes("invoiced")) {
    return "convert";
  }
  if (action.includes("deleted") || action.includes("removed")) {
    return "delete";
  }
  if (
    action.includes("status") ||
    action.includes("stage") ||
    action.includes("won") ||
    action.includes("lost") ||
    action.includes("reopened") ||
    action.includes("primary") ||
    action.includes("pricing") ||
    action.includes("rate")
  ) {
    return "status";
  }
  if (action.includes("created")) {
    return "create";
  }
  return "update";
}

const CATEGORY_META: Record<
  AuditActionView["category"],
  { tone: AuditActionView["tone"]; icon: string; label: string }
> = {
  create: { tone: "emerald", icon: "plus", label: "Created" },
  update: { tone: "blue", icon: "edit", label: "Updated" },
  status: { tone: "amber", icon: "spark", label: "Status" },
  delete: { tone: "rose", icon: "trash", label: "Removed" },
  security: { tone: "violet", icon: "shield", label: "Security" },
  convert: { tone: "emerald", icon: "arrow", label: "Converted" },
};

function quoted(value: string): string {
  return `“${value}”`;
}

function refName(ref: AuditDisplayRef): string {
  return ref.detail && ref.detail !== ref.label ? `${ref.label} · ${ref.detail}` : ref.label;
}

function subjectName(subject: AuditSubjectView): string {
  return subject.detail && subject.detail !== subject.label ? `${subject.label} · ${subject.detail}` : subject.label;
}

function targetPhrase(row: AuditListRow, context: AuditDisplayContext): string {
  const values = asRecord(row.newValues);
  const resolve = (field: string): string | null => {
    const ref = resolveRef(values[field], field, context);
    if (ref) {
      return refName(ref);
    }
    for (const key of ["opportunityNumber", "salesOrderNumber", "invoiceNumber", "tenderNumber", "leadNumber", "customerNumber", "displayName", "title"]) {
      const textValue = text(values[key]);
      if (textValue) {
        return textValue;
      }
    }
    return null;
  };

  if (row.action === "tenders.converted_to_opportunity" || row.action === "leads.converted" || row.action === "opportunities.converted") {
    const opportunity = resolve("opportunityId");
    return opportunity ? ` to ${quoted(opportunity)}` : "";
  }
  if (row.action === "opportunities.created") {
    const tender = resolve("tenderId");
    if (tender) {
      return ` from ${quoted(tender)}`;
    }
    const lead = resolve("createdFromLeadId");
    return lead ? ` from ${quoted(lead)}` : "";
  }
  if (row.action === "quotes.converted") {
    const order = resolve("salesOrderId");
    return order ? ` into ${quoted(order)}` : "";
  }
  if (row.action === "sales-orders.invoiced") {
    const invoice = resolve("invoiceId");
    return invoice ? ` as ${quoted(invoice)}` : "";
  }
  if (row.action === "payments.created" || row.action === "payments.updated" || row.action === "payments.deleted") {
    const invoice = resolve("invoiceId");
    return invoice ? ` against ${quoted(invoice)}` : "";
  }
  if (row.action === "resellers.customer.assigned") {
    const reseller = resolve("resellerId");
    return reseller ? ` to ${quoted(reseller)}` : "";
  }
  if (row.action === "resellers.customer.unassigned") {
    const reseller = resolve("resellerId");
    return reseller ? ` from ${quoted(reseller)}` : "";
  }
  if (row.action === "auth.impersonate") {
    const target = text(values.targetEmail);
    return target ? ` ${quoted(nameFromEmail(target))}` : "";
  }
  return "";
}

function actionVerb(action: string, label: string): string {
  const overrides: Record<string, string> = {
    "auth.login.succeeded": "signed in successfully",
    "auth.microsoft.login.succeeded": "signed in with Microsoft",
    "auth.login.failed": "had a failed sign-in attempt",
    "auth.password.changed": "changed their password",
    "auth.password-reset.requested": "requested a password reset",
    "auth.password-reset.completed": "completed a password reset",
    "auth.impersonate": "impersonated a user",
    "users.access.removed": "revoked access for",
    "users.password.reset": "reset the password for",
    "profile.avatar.updated": "updated the avatar for",
    "profile.avatar.removed": "removed the avatar for",
    "tenders.converted_to_opportunity": "converted tender",
    "leads.converted": "converted lead",
    "opportunities.converted": "converted opportunity",
    "quotes.converted": "converted quote",
    "sales-orders.invoiced": "invoiced sales order",
  };
  if (overrides[action]) {
    return overrides[action];
  }
  const lower = sentenceCase(label);
  if (lower.startsWith("status changed")) {
    return "changed the status of";
  }
  if (lower.startsWith("stage changed")) {
    return "changed the stage of";
  }
  if (lower.startsWith("converted to opportunity")) {
    return "converted tender";
  }
  if (lower.startsWith("access removed")) {
    return "revoked access for";
  }
  if (lower.startsWith("password reset")) {
    return "reset the password for";
  }
  if (lower.startsWith("address")) {
    return `${lower} for`;
  }
  if (lower.startsWith("contact") || lower.startsWith("customer") || lower.startsWith("reseller")) {
    return `${lower} for`;
  }
  return lower;
}

function buildHeadline(
  row: AuditListRow,
  actor: AuditActorView,
  subject: AuditSubjectView,
  context: AuditDisplayContext,
): string {
  const label = actionLabel(row.action);
  const verb = actionVerb(row.action, label);
  const target = targetPhrase(row, context);
  const selfActions = new Set([
    "auth.login.succeeded",
    "auth.microsoft.login.succeeded",
    "auth.login.failed",
    "auth.password.changed",
    "auth.password-reset.requested",
    "auth.password-reset.completed",
  ]);
  if (selfActions.has(row.action)) {
    return `${actor.name} ${verb}${target}`;
  }
  return `${actor.name} ${verb} ${quoted(subjectName(subject))}${target}`;
}

function buildDescription(
  facts: AuditFactView[],
  changes: AuditChangeView[],
  moduleKey: string,
  category: AuditActionView["category"],
): string {
  if (changes.length > 0) {
    const labels = changes.map((change) => change.label.toLowerCase());
    const summary = labels.length > 4 ? `${labels.slice(0, 4).join(", ")} +${labels.length - 4} more` : labels.join(", ");
    if (category === "delete") {
      return `Removed details: ${summary}`;
    }
    if (changes.every((change) => change.before === "—")) {
      return `Recorded ${summary}`;
    }
    return `Updated ${summary}`;
  }
  const highlights = facts.slice(0, 3).map((fact) => `${fact.label}: ${fact.value}`);
  if (highlights.length > 0) {
    return highlights.join(" · ");
  }
  return `${moduleLabel(moduleKey)} activity recorded`;
}

export function presentAuditRows(
  rows: AuditListRow[],
  context: AuditDisplayContext,
): AuditLogEntryView[] {
  return rows.map((row) => {
    const actor = buildActor(row, context);
    const subject = buildSubject(row, context);
    const changes = buildChanges(row.oldValues, row.newValues, context, row.action);
    const facts = buildFacts(row.oldValues, row.newValues, context);
    const label = actionLabel(row.action);
    const category = categoryFor(row.action);
    const meta = CATEGORY_META[category];
    const headline = buildHeadline(row, actor, subject, context);
    const description = buildDescription(facts, changes, row.module, category);
    const module = { key: row.module, label: moduleLabel(row.module) };
    const tags = [module.label, meta.label, subject.typeLabel];
    const searchText = [actor.name, actor.email, label, headline, description, subject.label, ...facts.map((fact) => fact.value)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actor,
      action: {
        key: row.action,
        label,
        headline,
        description,
        category,
        tone: meta.tone,
        icon: meta.icon,
      },
      module,
      subject,
      changes,
      facts,
      tags,
      searchText,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    };
  });
}
