import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PrintPreviewModal } from "@/components/documents/PrintPreviewModal.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { purchasingKeys } from "@/lib/query-keys.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  deleteGoodsReceipt,
  getGoodsReceipt,
  postGoodsReceipt,
  restoreGoodsReceipt,
} from "../api.ts";
import {
  Detail,
  ErrorState,
  LoadingState,
  MetricCard,
  MetricGrid,
  Panel,
  StatusPill,
  buildPrintableProps,
  docNumber,
  formatDate,
  formatQuantity,
  numberValue,
  statusLabel,
} from "../shared.tsx";

export default function GoodsReceiptDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canPost = useHasPermission(["purchasing:approve", "inventory:manage"]);
  const canDelete = useHasPermission(PURCHASING_PERMISSIONS.delete);
  const canRestore = useHasPermission(PURCHASING_PERMISSIONS.restore);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const receipt = useQuery({ queryKey: purchasingKeys.receipts.detail(id), queryFn: () => getGoodsReceipt(id), enabled: Boolean(id) });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasingKeys.receipts.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.orders.all() }), queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
      queryClient.invalidateQueries({ queryKey: purchasingKeys.hub() }),
    ]);
  };

  const post = useMutation({
    mutationFn: () => postGoodsReceipt(id),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deleteGoodsReceipt(id),
    onSuccess: async () => {
      setDeleteOpen(false);
      await navigate("/purchasing/receipts");
    },
    onError: (error) => {
      setDeleteOpen(false);
      setActionError(getApiErrorMessage(error));
    },
  });

  const restore = useMutation({
    mutationFn: () => restoreGoodsReceipt(id),
    onSuccess: refresh,
    onError: (error) => setActionError(getApiErrorMessage(error)),
  });

  if (receipt.isPending) {
    return <LoadingState label="Loading goods receipt…" />;
  }
  if (receipt.isError || !receipt.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState
          message={receipt.isError ? getApiErrorMessage(receipt.error) : "Goods receipt not found"}
          onRetry={() => receipt.refetch()}
          backTo="/purchasing/receipts"
          backLabel="Back to receipts"
        />
      </div>
    );
  }

  const row = receipt.data;
  const lines = row.lines ?? [];
  const totalQuantity = lines.reduce((sum, line) => sum + numberValue(line.receivedQuantity ?? line.quantity), 0);
  const printProps = buildPrintableProps({
    type: "GOODS RECEIPT",
    documentNumber: docNumber(row),
    date: formatDate(row.receiptDate),
    paymentTerms: "",
    partyName: row.vendor?.displayName ?? row.vendor?.name ?? "Vendor",
    partyAddress: row.vendor?.email ?? undefined,
    taxId: row.vendor?.legalName ?? undefined,
    lines: lines.map((line) => ({
      id: line.id,
      name: line.productName ?? line.description ?? "Item",
      description: line.location ? `Location: ${line.location}` : undefined,
      quantity: line.receivedQuantity ?? line.quantity,
      unitPrice: "0",
      lineTotal: "0",
    })),
    total: "0",
    notes: row.notes ?? undefined,
    currencyCode: row.currencyCode,
  });

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/purchasing/receipts">Purchasing / Receipts</Link>
          <span className="text-slate-400">/</span>
          <span className="font-mono text-slate-500">{docNumber(row)}</span>
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-950">{docNumber(row)}</h1>
              <StatusPill status={row.status} deleted={Boolean(row.deletedAt)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {row.vendor?.displayName ?? row.vendor?.name ?? "Vendor"} · Received {formatDate(row.receiptDate)} · {row.currencyCode}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.deletedAt ? (
              canRestore ? (
                <Button className="bg-emerald-700 hover:bg-emerald-800" disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {restore.isPending ? "Restoring…" : "Restore receipt"}
                </Button>
              ) : null
            ) : (
              <>
                {canPost && row.status === "DRAFT" ? (
                  <Button className="bg-brand-800 hover:bg-brand-900" disabled={post.isPending} onClick={() => post.mutate()}>
                    {post.isPending ? "Posting…" : "Post receipt"}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setPrintOpen(true)}>Print preview</Button>
                {canDelete && row.status === "DRAFT" ? (
                  <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>Delete</Button>
                ) : null}
              </>
            )}
          </div>
        </div>
        {row.status === "POSTED" ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            This receipt is posted. Stock movements have been created and the purchase order receipt quantities are updated.
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        ) : null}
      </div>

      <MetricGrid>
        <MetricCard label="Lines" value={String(lines.length)} hint="Items received" />
        <MetricCard label="Units received" value={formatQuantity(totalQuantity)} hint="Total quantity" />
        <MetricCard label="Receipt date" value={formatDate(row.receiptDate)} hint="Document date" />
        <MetricCard label="Status" value={statusLabel(row.status)} hint="Workflow state" />
      </MetricGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Panel title="Received lines">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Ordered</th>
                  <th className="py-2 pr-3 text-right">Received</th>
                  <th className="py-2">Location</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id ?? line.purchaseOrderLineId ?? index} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-800">{line.productName ?? line.description ?? "Item"}</p>
                      <p className="font-mono text-[11px] text-slate-400">{line.productCode ?? "—"}</p>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatQuantity(line.orderedQuantity)}</td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums">{formatQuantity(line.receivedQuantity ?? line.quantity)}</td>
                    <td className="py-2 text-slate-600">{line.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {row.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{row.notes}</p> : null}
        </Panel>

        <Panel title="Details">
          <dl className="grid gap-3 text-sm">
            <Detail label="Receipt number" value={docNumber(row)} />
            <Detail label="Purchase order" value={row.purchaseOrder ? docNumber(row.purchaseOrder) : null} />
            <Detail label="Vendor" value={row.vendor?.displayName ?? row.vendor?.name ?? null} />
            <Detail label="Status" value={statusLabel(row.status)} />
            <Detail label="Currency" value={row.currencyCode} />
            <Detail label="Vendor reference" value={row.vendorReference} />
            <Detail label="Posted" value={formatDate(row.postedAt)} />
            <Detail label="Created" value={formatDate(row.createdAt)} />
          </dl>
          {row.purchaseOrderId ? (
            <Link className="mt-4 inline-flex text-sm font-medium text-brand-800 hover:underline" to={`/purchasing/orders/${row.purchaseOrderId}`}>
              View purchase order
            </Link>
          ) : null}
        </Panel>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete goods receipt"
        description={`Delete ${docNumber(row)}? This receipt can be restored later with the right permission.`}
        confirmLabel="Delete receipt"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
      />

      <PrintPreviewModal isOpen={printOpen} onClose={() => setPrintOpen(false)} docProps={printProps} />
    </section>
  );
}
