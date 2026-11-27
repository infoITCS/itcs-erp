import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys, vendorKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  listGoodsReceipts,
  listPurchaseOrders,
  listVendorBills,
  listVendorPayments,
} from "../purchasing/api.ts";
import {
  Detail,
  ErrorState,
  LoadingState,
  MetricCard,
  MetricGrid,
  Panel,
  RowLink,
  StatusPill,
  docNumber,
  formatDate,
  formatMoney,
  statusLabel,
} from "../purchasing/shared.tsx";
import {
  VENDOR_PERMISSIONS,
  deleteVendor,
  getVendor,
  restoreVendor,
  updateVendor,
  type Vendor,
} from "./api.ts";

export default function VendorDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(VENDOR_PERMISSIONS.update);
  const canDelete = useHasPermission(VENDOR_PERMISSIONS.delete);
  const canRestore = useHasPermission(VENDOR_PERMISSIONS.restore);
  const canReadPurchasing = useHasPermission(PURCHASING_PERMISSIONS.read);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const vendor = useQuery({ queryKey: vendorKeys.detail(id), queryFn: () => getVendor(id), enabled: Boolean(id) });
  const orders = useQuery({
    queryKey: [...vendorKeys.detail(id), "purchase-orders"],
    queryFn: () => listPurchaseOrders({ vendorId: id, limit: 5 }),
    enabled: Boolean(id) && canReadPurchasing,
  });
  const receipts = useQuery({
    queryKey: [...vendorKeys.detail(id), "receipts"],
    queryFn: () => listGoodsReceipts({ vendorId: id, limit: 5 }),
    enabled: Boolean(id) && canReadPurchasing,
  });
  const bills = useQuery({
    queryKey: [...vendorKeys.detail(id), "bills"],
    queryFn: () => listVendorBills({ vendorId: id, limit: 5 }),
    enabled: Boolean(id) && canReadPurchasing,
  });
  const payments = useQuery({
    queryKey: [...vendorKeys.detail(id), "payments"],
    queryFn: () => listVendorPayments({ vendorId: id, limit: 5 }),
    enabled: Boolean(id) && canReadPurchasing,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: vendorKeys.all() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.all() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.formOptions() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.formOptions() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.bills.formOptions() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.payments.formOptions() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
    ]);
  };

  const remove = useMutation({
    mutationFn: () => deleteVendor(id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await refresh();
    },
    onError: (error) => {
      setDeleteOpen(false);
      setActionError(getApiErrorMessage(error));
    },
  });

  const restore = useMutation({
    mutationFn: () => restoreVendor(id),
    onSuccess: refresh,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const setStatus = useMutation({
    mutationFn: (status: Vendor["status"]) => updateVendor(id, { status }),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  if (vendor.isPending) {
    return <LoadingState label="Loading vendor…" />;
  }
  if (vendor.isError || !vendor.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState
          message={vendor.isError ? getApiErrorMessage(vendor.error) : "Vendor not found"}
          onRetry={() => vendor.refetch()}
          backTo="/vendors"
          backLabel="Back to vendors"
        />
      </div>
    );
  }

  const row: Vendor = vendor.data;
  const displayName = row.displayName ?? row.name;
  const address = [row.addressLine1, row.addressLine2, row.city, row.stateProvince, row.postalCode, row.countryCode].filter(Boolean).join(", ");
  const linkedDocuments = [
    ...(orders.data?.items ?? []).map((item) => ({
      id: item.id,
      label: docNumber(item),
      meta: `${statusLabel(item.status)} · ${formatMoney(item.total, item.currencyCode)}`,
      to: `/purchasing/orders/${item.id}`,
    })),
    ...(receipts.data?.items ?? []).map((item) => ({
      id: item.id,
      label: docNumber(item),
      meta: `${statusLabel(item.status)} · ${formatDate(item.receiptDate)}`,
      to: `/purchasing/receipts/${item.id}`,
    })),
    ...(bills.data?.items ?? []).map((item) => ({
      id: item.id,
      label: docNumber(item),
      meta: `${statusLabel(item.status)} · ${formatMoney(item.total, item.currencyCode)}`,
      to: `/purchasing/bills/${item.id}`,
    })),
    ...(payments.data?.items ?? []).map((item) => ({
      id: item.id,
      label: docNumber(item),
      meta: `${statusLabel(item.status)} · ${formatMoney(item.amount, item.currencyCode)}`,
      to: `/purchasing/payments/${item.id}`,
    })),
  ];
  const activity = [
    row.createdAt ? { id: "created", label: "Vendor created", at: row.createdAt, tone: "bg-slate-400" } : null,
    row.updatedAt && row.updatedAt !== row.createdAt
      ? { id: "updated", label: "Vendor updated", at: row.updatedAt, tone: "bg-brand-600" }
      : null,
    row.deletedAt ? { id: "deleted", label: "Vendor deleted", at: row.deletedAt, tone: "bg-amber-500" } : null,
  ].filter((item): item is { id: string; label: string; at: string; tone: string } => Boolean(item));

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/vendors">Supply / Vendors</Link>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-500">{row.code ?? row.id.slice(0, 8)}</span>
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-950">{displayName}</h1>
              <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {row.legalName && row.legalName !== displayName ? `${row.legalName} · ` : ""}
              {row.currencyCode} · {row.paymentTerm?.name ?? "No payment term"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.deletedAt ? (
              canRestore ? (
                <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {restore.isPending ? "Restoring…" : "Restore vendor"}
                </Button>
              ) : null
            ) : (
              <>
                {canUpdate ? (
                  <Link to={`/vendors/${id}/edit`}>
                    <Button variant="secondary">Edit vendor</Button>
                  </Link>
                ) : null}
                {canDelete ? (
                  <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
        {row.deletedAt ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This vendor was deleted on {formatDate(row.deletedAt)}. Restore it to use it on new documents.
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
        {canUpdate && !row.deletedAt ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
            {row.status !== "ACTIVE" ? (
              <Button
                className="bg-emerald-700 hover:bg-emerald-800"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate("ACTIVE")}
              >
                {setStatus.variables === "ACTIVE" && setStatus.isPending ? "Updating…" : "Activate"}
              </Button>
            ) : null}
            {row.status !== "SUSPENDED" ? (
              <Button variant="secondary" disabled={setStatus.isPending} onClick={() => setStatus.mutate("SUSPENDED")}>
                {setStatus.variables === "SUSPENDED" && setStatus.isPending ? "Updating…" : "Suspend"}
              </Button>
            ) : null}
            {row.status !== "INACTIVE" ? (
              <Button variant="ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate("INACTIVE")}>
                {setStatus.variables === "INACTIVE" && setStatus.isPending ? "Updating…" : "Deactivate"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <MetricGrid>
        <MetricCard label="Vendor code" value={row.code ?? row.id.slice(0, 8)} hint="Supplier identifier" />
        <MetricCard label="Currency" value={row.currencyCode} hint="Settlement currency" />
        <MetricCard label="Status" value={statusLabel(row.status)} hint="Purchasing eligibility" />
        <MetricCard label="Linked documents" value={String(linkedDocuments.length)} hint="Recent purchase records" />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title="Identity & classification">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Vendor code" value={row.code} />
              <Detail label="Name" value={row.name} />
              <Detail label="Display name" value={row.displayName} />
              <Detail label="Legal name" value={row.legalName} />
              <Detail label="Type" value={row.vendorType ? statusLabel(row.vendorType) : null} />
              <Detail label="Category" value={row.category} />
              <Detail label="Status" value={statusLabel(row.status)} />
              <Detail label="Registration number" value={row.registrationNumber} />
            </dl>
          </Panel>
          <Panel title="Contact & address">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Email" value={row.email} />
              <Detail label="Phone" value={row.phone} />
              <Detail label="Website" value={row.website} />
              <Detail label="Tax ID" value={row.taxId} />
              <Detail label="Address" value={address} />
            </dl>
          </Panel>
          {row.notes ? (
            <Panel title="Notes">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{row.notes}</p>
            </Panel>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="Commercial & accounting">
            <dl className="grid gap-3">
              <Detail label="Currency" value={row.currencyCode} />
              <Detail label="Payment term" value={row.paymentTerm ? `${row.paymentTerm.name} (${row.paymentTerm.dueDays} days)` : null} />
              <Detail label="Tax code" value={row.taxCode ? `${row.taxCode.code} (${row.taxCode.rate}%)` : null} />
              <Detail label="Bank account" value={row.bankAccount} />
              <Detail label="Created" value={formatDate(row.createdAt)} />
              <Detail label="Updated" value={formatDate(row.updatedAt)} />
            </dl>
          </Panel>

          {canReadPurchasing ? (
            <Panel title="Recent purchasing documents">
              {linkedDocuments.length === 0 ? (
                <p className="text-sm text-slate-500">No purchase orders, receipts, bills or payments are linked to this vendor yet.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {linkedDocuments.map((item) => (
                    <li key={`${item.to}-${item.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                      <RowLink to={item.to}>{item.label}</RowLink>
                      <span className="text-right text-xs text-slate-500">{item.meta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {activity.length > 0 ? (
            <Panel title="Record activity">
              <ol className="flex flex-col gap-4 text-sm">
                {activity.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.tone}`} />
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{formatDate(item.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete vendor"
        description={`Delete ${displayName}? The vendor can be restored later with the right permission.`}
        confirmLabel="Delete vendor"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />
    </section>
  );
}
