import { Modal } from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  body?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Bevestigen",
  cancelLabel = "Annuleren",
  loading,
  onCancel,
  onConfirm,
  body
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/30"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm();
            }}
            disabled={loading}
            className="rounded-lg bg-axoft-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-axoft-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-axoft-500 disabled:cursor-not-allowed disabled:bg-axoft-500/60"
          >
            {loading ? "Verwerken..." : confirmLabel}
          </button>
        </>
      }
    >
      {body ? (
        <div className="text-sm text-slate-300">{body}</div>
      ) : (
        <p className="text-sm text-slate-300">
          Weet je zeker dat je deze actie wilt uitvoeren? Dit kan niet ongedaan worden gemaakt.
        </p>
      )}
    </Modal>
  );
}
