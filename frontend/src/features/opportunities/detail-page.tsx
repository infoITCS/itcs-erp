import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FormField } from "@/components/forms/FormField.tsx";
import { ConfirmDialog } from "@/components/modals/ConfirmDialog.tsx";
import { Modal } from "@/components/modals/Modal.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { getApiErrorMessage } from "@/utils/api-error.ts";
import { listCustomers } from "@/features/customers/api.ts";
import { listProducts } from "@/features/products/api.ts";
import { stageLabel } from "./index.tsx";
import {
  ALL_STAGES,
  LOST_REASONS,
  OPEN_STAGES,
  changeOpportunityStage,
  convertOpportunity,
  createProductInterest,
  deleteOpportunity,
  deleteProductInterest,
  getOpportunity,
  listOpportunityAudit,
  listProductInterests,
  markOpportunityLost,
  markOpportunityWon,
  reopenOpportunity,
  restoreOpportunity,
  updateProductInterest,
  type ConvertWrite,
  type OpportunityLostReason,
  type OpportunityStage,
  type ProductInterestWrite,
} from "./api.ts";

type PendingDelete = { kind: "opportunity" } | { kind: "interest"; id: string; label: string };

export default function OpportunityDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageTarget, setStageTarget] = useState<OpportunityStage>("NEW");
  const [stageProbability, setStageProbability] = useState("");
  const [stageApplyDefault, setStageApplyDefault] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  const [wonConfirmOpen, setWonConfirmOpen] = useState(false);
  const [wonApplyDefault, setWonApplyDefault] = useState(false);
  const [wonError, setWonError] = useState<string | null>(null);

  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostApplyDefault, setLostApplyDefault] = useState(false);
  const [lostError, setLostError] = useState<string | null>(null);

  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [reopenStage, setReopenStage] = useState<OpportunityStage>("NEW");
  const [reopenApplyDefault, setReopenApplyDefault] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertMode, setConvertMode] = useState<"LINK" | "CREATE">("LINK");
  const [convertError, setConvertError] = useState<string | null>(null);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [editingInterest, setEditingInterest] = useState<string | null>(null);

  const opportunity = useQuery({ queryKey: ["opportunities", id], queryFn: () => getOpportunity(id) });
  const interests = useQuery({ queryKey: ["opportunities", id, "products"], queryFn: () => listProductInterests(id) });
  const audit = useQuery({ queryKey: ["opportunities", id, "audit"], queryFn: () => listOpportunityAudit(id) });
  const customerPicker = useQuery({
    queryKey: ["customers", "picker", "active"],
    queryFn: () => listCustomers({ limit: 100, status: "ACTIVE" }),
    enabled: convertModalOpen && convertMode === "LINK",
  });
  const [productQuery, setProductQuery] = useState("");
  const productPicker = useQuery({
    queryKey: ["products", "picker", productQuery],
    queryFn: () => listProducts({ q: productQuery || undefined, status: "ACTIVE", limit: 20 }),
    enabled: productModalOpen,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["opportunities", id] });
  };
  const refreshList = async () => {
    await queryClient.invalidateQueries({ queryKey: ["opportunities", "list"] });
  };
  const refreshInterests = async () => {
    await queryClient.invalidateQueries({ queryKey: ["opportunities", id, "products"] });
  };

  const removeOpportunity = useMutation({
    mutationFn: () => deleteOpportunity(id),
    onSuccess: async () => {
      await refreshList();
      navigate("/opportunities");
    },
  });

  const restore = useMutation({
    mutationFn: () => restoreOpportunity(id),
    onSuccess: async () => {
      await refresh();
      await refreshList();
    },
  });

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setConfirmBusy(true);
    try {
      if (pendingDelete.kind === "opportunity") {
        await removeOpportunity.mutateAsync();
      } else {
        await deleteProductInterest(id, pendingDelete.id);
        await refreshInterests();
      }
      setPendingDelete(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  const data = opportunity.data;
  const isOpenStage = data ? (OPEN_STAGES as string[]).includes(data.stage) : false;
  const isTerminal = data ? data.stage === "WON" || data.stage === "LOST" : false;

  return (
    <section className="flex flex-col gap-6">
      {opportunity.isPending ? <p className="text-sm text-slate-500">Loading opportunity…</p> : null}
      {opportunity.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(opportunity.error)}</p> : null}
      {data ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-teal-800">
                <span className="h-2 w-2 rounded-full bg-teal-600" />
                CRM / Pipeline
              </p>
              <p className="font-mono text-xs text-slate-500">
                {data.opportunityNumber}
                {data.deletedAt ? " · Deleted" : ""}
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-950">{data.title}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {stageLabel(data.stage)} · {data.probabilityPercent}% · {data.estimatedValue} {data.currencyCode}
              </p>
            </div>
            <div className="flex gap-2">
              {data.deletedAt ? (
                <Button variant="secondary" disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {restore.isPending ? "Restoring…" : "Restore"}
                </Button>
              ) : (
                <>
                  <Link
                    to={`/opportunities/${id}/edit`}
                    className="inline-flex h-10 items-center rounded-md border border-slate-300 px-3 text-sm"
                  >
                    Edit
                  </Link>
                  <Button variant="secondary" className="h-10" onClick={() => setPendingDelete({ kind: "opportunity" })}>
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
          {restore.isError ? <p className="text-sm text-red-700">{getApiErrorMessage(restore.error)}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Estimated value"
              value={`${data.estimatedValue} ${data.currencyCode}`}
              hint={data.estimatedValueBase ? `${data.estimatedValueBase} ${data.baseCurrencyCode ?? ""} base` : undefined}
            />
            <MetricCard label="Probability" value={`${data.probabilityPercent}%`}>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-teal-600 transition-all duration-500"
                  style={{ width: `${data.probabilityPercent}%` }}
                />
              </span>
            </MetricCard>
            <MetricCard
              label="Expected close"
              value={data.expectedCloseDate ? String(data.expectedCloseDate).slice(0, 10) : "Not set"}
              tone={
                data.expectedCloseDate &&
                isOpenStage &&
                String(data.expectedCloseDate).slice(0, 10) < new Date().toISOString().slice(0, 10)
                  ? "amber"
                  : "slate"
              }
              hint={
                data.expectedCloseDate &&
                isOpenStage &&
                String(data.expectedCloseDate).slice(0, 10) < new Date().toISOString().slice(0, 10)
                  ? "Past due"
                  : undefined
              }
            />
            <MetricCard
              label="Next action"
              value={data.nextAction ?? "None set"}
              tone={
                data.nextActionDueAt && new Date(data.nextActionDueAt).getTime() < Date.now() && isOpenStage ? "amber" : "slate"
              }
              hint={
                data.nextActionDueAt
                  ? `Due ${new Date(data.nextActionDueAt).toLocaleString()}`
                  : undefined
              }
            />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Pipeline stage</h2>
              <p className="text-xs text-slate-500">
                {isOpenStage ? "Select a stage to advance the deal" : "Closed deals reopen from the actions below"}
              </p>
            </div>
            <ol className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {ALL_STAGES.map((step, index) => {
                const currentIndex = ALL_STAGES.indexOf(data.stage);
                const isCurrent = step === data.stage;
                const isPast = index < currentIndex;
                const canJump = isOpenStage && (OPEN_STAGES as string[]).includes(step) && step !== data.stage;
                return (
                  <li key={step}>
                    <button
                      type="button"
                      disabled={!canJump}
                      onClick={() => {
                        if (!canJump) {
                          return;
                        }
                        setStageTarget(step);
                        setStageProbability("");
                        setStageApplyDefault(false);
                        setStageError(null);
                        setStageModalOpen(true);
                      }}
                      className={`flex w-full flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition ${
                        isCurrent
                          ? step === "WON"
                            ? "border-emerald-300 bg-emerald-50 shadow-sm"
                            : step === "LOST"
                              ? "border-amber-300 bg-amber-50 shadow-sm"
                              : "border-teal-300 bg-teal-50 shadow-sm"
                          : canJump
                            ? "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40"
                            : isPast
                              ? "border-slate-100 bg-slate-50 text-slate-500"
                              : "border-slate-100 bg-white text-slate-400"
                      } ${canJump ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {index + 1}
                      </span>
                      <span className={`text-xs font-semibold ${isCurrent ? "text-slate-950" : ""}`}>
                        {stageLabel(step)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              {isOpenStage ? (
                <>
                  <Button
                    variant="secondary"
                    className="h-9"
                    onClick={() => {
                      setStageTarget(data.stage);
                      setStageProbability("");
                      setStageApplyDefault(false);
                      setStageError(null);
                      setStageModalOpen(true);
                    }}
                  >
                    Change stage
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    disabled={!data.customerId}
                    title={!data.customerId ? "Link a customer before marking this won" : undefined}
                    onClick={() => {
                      setWonApplyDefault(false);
                      setWonError(null);
                      setWonConfirmOpen(true);
                    }}
                  >
                    Mark won
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9"
                    onClick={() => {
                      setLostApplyDefault(false);
                      setLostError(null);
                      setLostModalOpen(true);
                    }}
                  >
                    Mark lost
                  </Button>
                </>
              ) : null}
              {isTerminal ? (
                <Button
                  className="h-9 !bg-teal-800 !text-white hover:!bg-teal-900"
                  onClick={() => {
                    setReopenStage(data.customerId ? "NEGOTIATION" : "QUALIFICATION");
                    setReopenApplyDefault(false);
                    setReopenError(null);
                    setReopenConfirmOpen(true);
                  }}
                >
                  Reopen
                </Button>
              ) : null}
              {!data.customerId ? (
                <Button
                  className="h-9 !bg-teal-800 !text-white hover:!bg-teal-900"
                  onClick={() => {
                    setConvertMode("LINK");
                    setConvertError(null);
                    setConvertModalOpen(true);
                  }}
                >
                  Convert prospect
                </Button>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Customer / prospect</dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {data.customer ? (
                    <Link className="font-medium text-teal-800 underline-offset-2 hover:underline" to={`/customers/${data.customer.id}`}>
                      {data.customer.displayName} ({data.customer.customerNumber})
                    </Link>
                  ) : (
                    data.prospectDisplayName ?? "Not set"
                  )}
                </dd>
              </div>
              {data.contact ? (
                <div>
                  <dt className="text-xs text-slate-500">Contact</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">{data.contact.displayName}</dd>
                </div>
              ) : null}
              {!data.customer && (data.prospectEmail || data.prospectPhone || data.prospectCountryCode) ? (
                <div>
                  <dt className="text-xs text-slate-500">Prospect details</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {[data.prospectEmail, data.prospectPhone, data.prospectCountryCode].filter(Boolean).join(" · ")}
                  </dd>
                </div>
              ) : null}
              {data.reseller ? (
                <div>
                  <dt className="text-xs text-slate-500">Reseller</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">{data.reseller.displayName}</dd>
                </div>
              ) : null}
              {data.owner ? (
                <div>
                  <dt className="text-xs text-slate-500">Owner</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {data.owner.firstName} {data.owner.lastName}
                  </dd>
                </div>
              ) : null}
              {data.leadSource ? (
                <div>
                  <dt className="text-xs text-slate-500">Lead source</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">{stageLabel(data.leadSource)}</dd>
                </div>
              ) : null}
              {data.competitorName ? (
                <div>
                  <dt className="text-xs text-slate-500">Competitor</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">{data.competitorName}</dd>
                </div>
              ) : null}
              {data.stage === "LOST" && data.lostReason ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Lost reason</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {stageLabel(data.lostReason)}
                    {data.lostReasonDetail ? ` · ${data.lostReasonDetail}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
            {data.description ? <p className="mt-3 text-sm text-slate-700">{data.description}</p> : null}
            {data.notes ? <p className="mt-2 text-sm text-slate-600">Notes: {data.notes}</p> : null}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Product interests</h2>
              <Button
                variant="secondary"
                onClick={() => {
                  setProductError(null);
                  setProductQuery("");
                  setProductModalOpen(true);
                }}
              >
                Add product
              </Button>
            </div>
            {interests.isPending ? <p className="text-sm text-slate-500">Loading product interests…</p> : null}
            {(interests.data ?? []).length === 0 && !interests.isPending ? (
              <p className="text-sm text-slate-500">No product interests yet.</p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {(interests.data ?? []).map((interest) =>
                editingInterest === interest.id ? (
                  <li key={interest.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                    <form
                      className="grid gap-3 md:grid-cols-3"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        setProductError(null);
                        try {
                          await updateProductInterest(id, interest.id, {
                            quantity: String(form.get("quantity") ?? "") || undefined,
                            estimatedUnitAmount: String(form.get("estimatedUnitAmount") ?? "") || null,
                            notes: String(form.get("notes") ?? "") || null,
                          });
                          await refreshInterests();
                          setEditingInterest(null);
                        } catch (error) {
                          setProductError(getApiErrorMessage(error));
                        }
                      }}
                    >
                      <FormField label="Quantity" htmlFor={`quantity-${interest.id}`}>
                        <Input id={`quantity-${interest.id}`} name="quantity" defaultValue={interest.quantity} />
                      </FormField>
                      <FormField label="Estimated unit amount" htmlFor={`amount-${interest.id}`}>
                        <Input
                          id={`amount-${interest.id}`}
                          name="estimatedUnitAmount"
                          defaultValue={interest.estimatedUnitAmount ?? ""}
                        />
                      </FormField>
                      <FormField label="Notes" htmlFor={`notes-${interest.id}`}>
                        <Input id={`notes-${interest.id}`} name="notes" defaultValue={interest.notes ?? ""} />
                      </FormField>
                      <div className="flex gap-2 md:col-span-3">
                        <Button type="submit">Save</Button>
                        <Button type="button" variant="secondary" onClick={() => setEditingInterest(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </li>
                ) : (
                  <li
                    key={interest.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {interest.productCode} · {interest.productName}
                      </p>
                      <p className="text-slate-600">
                        Qty {interest.quantity}
                        {interest.estimatedUnitAmount ? ` · ${interest.estimatedUnitAmount} each` : ""}
                        {interest.notes ? ` · ${interest.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" className="text-slate-700" onClick={() => setEditingInterest(interest.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-700"
                        onClick={() =>
                          setPendingDelete({ kind: "interest", id: interest.id, label: interest.productName })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Recent audit</h2>
            {audit.isPending ? <p className="text-sm text-slate-500">Loading audit…</p> : null}
            {(audit.data?.items ?? []).length === 0 && !audit.isPending ? (
              <p className="text-sm text-slate-500">No audit events yet.</p>
            ) : null}
            <ul className="flex flex-col gap-1 text-sm text-slate-700">
              {(audit.data?.items ?? []).map((event) => (
                <li key={event.id}>
                  {event.action} · {new Date(event.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>

          <ConfirmDialog
            open={pendingDelete !== null}
            title={pendingDelete?.kind === "opportunity" ? "Delete opportunity?" : "Remove product interest?"}
            description={
              pendingDelete?.kind === "opportunity" ? (
                <p>
                  Soft-delete <span className="font-medium text-slate-900">{data.title}</span>? You can restore it later with
                  the right permission.
                </p>
              ) : (
                <p>
                  Remove <span className="font-medium text-slate-900">{pendingDelete?.label}</span> from this opportunity?
                </p>
              )
            }
            confirmLabel={pendingDelete?.kind === "opportunity" ? "Delete opportunity" : "Remove"}
            busy={confirmBusy || removeOpportunity.isPending}
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              void confirmDelete();
            }}
          />

          <Modal open={stageModalOpen} title="Change stage" onClose={() => setStageModalOpen(false)}>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setStageError(null);
                try {
                  await changeOpportunityStage(id, {
                    stage: stageTarget,
                    probabilityPercent: stageProbability.trim() ? Number(stageProbability) : undefined,
                    applyStageDefault: stageApplyDefault,
                  });
                  await refresh();
                  await refreshList();
                  setStageModalOpen(false);
                } catch (error) {
                  setStageError(getApiErrorMessage(error));
                }
              }}
            >
              <FormField label="Target stage" htmlFor="stageTarget">
                <select
                  id="stageTarget"
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={stageTarget}
                  onChange={(event) => setStageTarget(event.target.value as OpportunityStage)}
                >
                  {OPEN_STAGES.map((value) => (
                    <option key={value} value={value}>
                      {stageLabel(value)}
                    </option>
                  ))}
                </select>
              </FormField>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={stageApplyDefault}
                  onChange={(event) => setStageApplyDefault(event.target.checked)}
                />
                Apply the stage&apos;s default probability
              </label>
              {!stageApplyDefault ? (
                <FormField label="Probability %" htmlFor="stageProbability">
                  <Input
                    id="stageProbability"
                    type="number"
                    min={0}
                    max={100}
                    value={stageProbability}
                    onChange={(event) => setStageProbability(event.target.value)}
                  />
                </FormField>
              ) : null}
              {stageError ? <p className="text-sm text-red-700">{stageError}</p> : null}
              <Button type="submit">Save stage</Button>
            </form>
          </Modal>

          <ConfirmDialog
            open={wonConfirmOpen}
            title="Mark opportunity as won?"
            description={
              <div className="flex flex-col gap-2">
                <p>
                  Mark <span className="font-medium text-slate-900">{data.title}</span> as won? The current probability
                  stays {data.probabilityPercent}% unless you apply the won default.
                </p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wonApplyDefault}
                    onChange={(event) => setWonApplyDefault(event.target.checked)}
                  />
                  Apply the won default (100%)
                </label>
                {wonError ? <p className="text-red-700">{wonError}</p> : null}
              </div>
            }
            confirmLabel="Mark won"
            onCancel={() => setWonConfirmOpen(false)}
            onConfirm={async () => {
              setWonError(null);
              try {
                await markOpportunityWon(id, wonApplyDefault ? { applyStageDefault: true } : {});
                await refresh();
                await refreshList();
                setWonConfirmOpen(false);
              } catch (error) {
                setWonError(getApiErrorMessage(error));
              }
            }}
          />

          <Modal open={lostModalOpen} title="Mark opportunity as lost" onClose={() => setLostModalOpen(false)}>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                setLostError(null);
                try {
                  await markOpportunityLost(id, {
                    lostReason: String(form.get("lostReason") ?? "OTHER") as OpportunityLostReason,
                    lostReasonDetail: String(form.get("lostReasonDetail") ?? "") || undefined,
                    competitorName: String(form.get("competitorName") ?? "") || undefined,
                    ...(lostApplyDefault ? { applyStageDefault: true } : {}),
                  });
                  await refresh();
                  await refreshList();
                  setLostModalOpen(false);
                } catch (error) {
                  setLostError(getApiErrorMessage(error));
                }
              }}
            >
              <FormField label="Lost reason" htmlFor="lostReason">
                <select id="lostReason" name="lostReason" className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm" defaultValue="OTHER">
                  {LOST_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {stageLabel(value)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Detail" htmlFor="lostReasonDetail">
                <Input id="lostReasonDetail" name="lostReasonDetail" maxLength={500} />
              </FormField>
              <FormField label="Competitor name" htmlFor="lostCompetitorName">
                <Input id="lostCompetitorName" name="competitorName" maxLength={200} defaultValue={data.competitorName ?? ""} />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={lostApplyDefault}
                  onChange={(event) => setLostApplyDefault(event.target.checked)}
                />
                Apply the lost default (0%)
              </label>
              {lostError ? <p className="text-sm text-red-700">{lostError}</p> : null}
              <Button type="submit">Mark lost</Button>
            </form>
          </Modal>

          <ConfirmDialog
            open={reopenConfirmOpen}
            title="Reopen opportunity?"
            description={
              <div className="flex flex-col gap-3">
                <p>Choose the stage to reopen into. The current probability is kept unless you apply that stage&apos;s default.</p>
                <select
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={reopenStage}
                  onChange={(event) => setReopenStage(event.target.value as OpportunityStage)}
                >
                  {OPEN_STAGES.map((value) => (
                    <option key={value} value={value}>
                      {stageLabel(value)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reopenApplyDefault}
                    onChange={(event) => setReopenApplyDefault(event.target.checked)}
                  />
                  Apply the stage default probability
                </label>
                {reopenError ? <p className="text-red-700">{reopenError}</p> : null}
              </div>
            }
            confirmLabel="Reopen"
            onCancel={() => setReopenConfirmOpen(false)}
            onConfirm={async () => {
              setReopenError(null);
              try {
                await reopenOpportunity(id, {
                  stage: reopenStage,
                  ...(reopenApplyDefault ? { applyStageDefault: true } : {}),
                });
                await refresh();
                await refreshList();
                setReopenConfirmOpen(false);
              } catch (error) {
                setReopenError(getApiErrorMessage(error));
              }
            }}
          />

          <Modal open={convertModalOpen} title="Convert opportunity" onClose={() => setConvertModalOpen(false)}>
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={convertMode === "LINK"}
                    onChange={() => setConvertMode("LINK")}
                  />
                  Link existing customer
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={convertMode === "CREATE"}
                    onChange={() => setConvertMode("CREATE")}
                  />
                  Create new customer
                </label>
              </div>
              {convertMode === "LINK" ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const customerId = String(form.get("customerId") ?? "");
                    setConvertError(null);
                    try {
                      await convertOpportunity(id, { mode: "LINK", customerId });
                      await refresh();
                      await refreshList();
                      setConvertModalOpen(false);
                    } catch (error) {
                      setConvertError(getApiErrorMessage(error));
                    }
                  }}
                >
                  <FormField label="Customer" htmlFor="convertCustomerId">
                    <select
                      id="convertCustomerId"
                      name="customerId"
                      required
                      className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                    >
                      <option value="">{customerPicker.isPending ? "Loading…" : "Select customer"}</option>
                      {(customerPicker.data?.items ?? []).map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.displayName} ({customer.customerNumber})
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {convertError ? <p className="text-sm text-red-700">{convertError}</p> : null}
                  <Button type="submit">Link customer</Button>
                </form>
              ) : (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const body: ConvertWrite = {
                      mode: "CREATE",
                      customer: {
                        entityType: "COMPANY",
                        customerType: String(form.get("customerType") ?? "COMPANY") as
                          | "COMPANY"
                          | "INDIVIDUAL"
                          | "B2B"
                          | "B2C"
                          | "WHOLESALE",
                        legalName: String(form.get("legalName") ?? ""),
                        displayName: String(form.get("displayName") ?? ""),
                        countryCode: String(form.get("countryCode") ?? "").toUpperCase(),
                        currencyCode: String(form.get("currencyCode") ?? "").toUpperCase(),
                        email: String(form.get("email") ?? "") || undefined,
                        phone: String(form.get("phone") ?? "") || undefined,
                      },
                    };
                    setConvertError(null);
                    try {
                      await convertOpportunity(id, body);
                      await refresh();
                      await refreshList();
                      setConvertModalOpen(false);
                    } catch (error) {
                      setConvertError(getApiErrorMessage(error));
                    }
                  }}
                >
                  <FormField label="Customer type" htmlFor="customerType">
                    <select
                      id="customerType"
                      name="customerType"
                      className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                      defaultValue="COMPANY"
                    >
                      <option value="COMPANY">Company</option>
                      <option value="INDIVIDUAL">Individual</option>
                      <option value="B2B">B2B</option>
                      <option value="B2C">B2C</option>
                      <option value="WHOLESALE">Wholesale</option>
                    </select>
                  </FormField>
                  <FormField label="Legal name" htmlFor="legalName">
                    <Input id="legalName" name="legalName" required defaultValue={data.prospectLegalName ?? ""} />
                  </FormField>
                  <FormField label="Display name" htmlFor="displayName">
                    <Input id="displayName" name="displayName" required defaultValue={data.prospectDisplayName ?? ""} />
                  </FormField>
                  <FormField label="Email" htmlFor="convertEmail">
                    <Input id="convertEmail" name="email" type="email" defaultValue={data.prospectEmail ?? ""} />
                  </FormField>
                  <FormField label="Phone" htmlFor="convertPhone">
                    <Input id="convertPhone" name="phone" defaultValue={data.prospectPhone ?? ""} />
                  </FormField>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Country" htmlFor="convertCountryCode">
                      <Input
                        id="convertCountryCode"
                        name="countryCode"
                        maxLength={2}
                        required
                        defaultValue={data.prospectCountryCode ?? "PK"}
                      />
                    </FormField>
                    <FormField label="Currency" htmlFor="convertCurrencyCode">
                      <Input id="convertCurrencyCode" name="currencyCode" maxLength={3} required defaultValue={data.currencyCode} />
                    </FormField>
                  </div>
                  {convertError ? <p className="text-sm text-red-700">{convertError}</p> : null}
                  <Button type="submit">Create customer</Button>
                </form>
              )}
            </div>
          </Modal>

          <Modal open={productModalOpen} title="Add product interest" onClose={() => setProductModalOpen(false)}>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const body: ProductInterestWrite = {
                  productId: String(form.get("productId") ?? ""),
                  quantity: String(form.get("quantity") ?? "") || undefined,
                  estimatedUnitAmount: String(form.get("estimatedUnitAmount") ?? "") || undefined,
                  notes: String(form.get("notes") ?? "") || undefined,
                };
                setProductError(null);
                try {
                  await createProductInterest(id, body);
                  await refreshInterests();
                  setProductModalOpen(false);
                } catch (error) {
                  setProductError(getApiErrorMessage(error));
                }
              }}
            >
              <FormField label="Search products" htmlFor="productQuery">
                <Input
                  id="productQuery"
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Code or name"
                />
              </FormField>
              <FormField label="Product" htmlFor="productId">
                <select id="productId" name="productId" required className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm">
                  <option value="">{productPicker.isPending ? "Loading…" : "Select product"}</option>
                  {(productPicker.data?.items ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} · {product.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Quantity" htmlFor="newQuantity">
                <Input id="newQuantity" name="quantity" placeholder="1.0000" />
              </FormField>
              <FormField label="Estimated unit amount" htmlFor="newEstimatedUnitAmount">
                <Input id="newEstimatedUnitAmount" name="estimatedUnitAmount" placeholder="0.0000" />
              </FormField>
              <FormField label="Notes" htmlFor="newProductNotes">
                <Input id="newProductNotes" name="notes" />
              </FormField>
              {productError ? <p className="text-sm text-red-700">{productError}</p> : null}
              <Button type="submit">Add product</Button>
            </form>
          </Modal>
        </>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "slate",
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "slate" | "amber";
  children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm transition hover:border-slate-300 ${
        tone === "amber" ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold ${tone === "amber" ? "text-amber-900" : "text-slate-950"}`}>
        {value}
      </p>
      {hint ? <p className={`mt-1 text-xs ${tone === "amber" ? "text-amber-700" : "text-slate-500"}`}>{hint}</p> : null}
      {children}
    </div>
  );
}
