import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button.tsx";
import { Modal } from "@/components/modals/Modal.tsx";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  confirmDisabled = false,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={busy ? () => undefined : onCancel}>
      <div className="flex flex-col gap-4">
        <div className="text-sm text-slate-600">{description}</div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className={danger ? "bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300" : undefined}
          >
            {busy ? "Working..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
