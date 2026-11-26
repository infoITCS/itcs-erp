import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { useHasPermission } from "@/hooks/useSession.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import {
  PURCHASING_PERMISSIONS,
  deleteGoodsReceipt,
  getGoodsReceipt,
  postGoodsReceipt,
  restoreGoodsReceipt,
} from "../api.ts";
import { Detail, Metric, Panel, StatusPill, docNumber, formatDate, formatQuantity, numberValue, statusLabel } from "../shared.tsx";

export default function GoodsReceiptDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(PURCHASING_PERMISSIONS.update);
  const canDelete = useHasPermission(PURCHASING_PERMISSIONS.delete);
  const canRestore = useHasPermission(PURCHASING_PERMISSIONS.restore);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const receipt = useQuery({ queryKey: ["purchasing", "receipts", id], queryFn: () => getGoodsReceipt(id), enabled: Boolean(id) });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["purchasing", "receipts"] }),
      queryClient.invalidateQueries({ queryKey: ["purchasing", "orders"] }),
      queryClient.invalidateQueries({ queryKey: ["purchasing", "hub"] }),
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
    return <p className="text-sm text-slate-500">Loading goods receipt…</p>;
  }
  if (receipt.isError || !receipt.data) {
    return <p className="text-sm text-red-700">{receipt.isError ? getApiErrorMessage(receipt.error) : "Goods receipt not found"}</p>;
  }

  const row = receipt.data;
  const lines = row.lines ?? [];
  const totalQuantity = lines.reduce((sum, line) => sum + numberValue(line.receivedQuantity ?? line.quantity), 0);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="border-b border-slate-200 pb-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-800">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          <Link className="hover:underline" to="/purchasing/receipts">Supply / Receipts</Link>
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
                {canUpdate && row.status === "DRAFT" ? (
                  <Button className="bg-brand-800 hover:bg-brand-900" disabled={post.isPending} onClick={() => post.mutate()}>
                    {post.isPending ? "Posting…" : "Post receipt"}
                  </Button>
                ) : null}
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Lines" value={String(lines.length)} />
        <Metric label="Units received" value={formatQuantity(totalQuantity)} />
        <Metric label="Receipt date" value={formatDate(row.receiptDate)} />
        <Metric label="Status" value={statusLabel(row.status)} />
      </div>

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
            <Detail label="Posted" value={formatDate((row as typeof row & { postedAt?: string | null }).postedAt)} />
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
    </section>
  );
}
