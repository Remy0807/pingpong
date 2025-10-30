type ModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const sizeClassNames: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export function Modal({
  open,
  title,
  description,
  size = "md",
  onClose,
  children,
  footer,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
      <div
        className={`glass-card relative w-full ${sizeClassNames[size]} max-h-[90vh] rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
          aria-label="Venster sluiten"
        >
          X
        </button>
        <div className="max-h-[90vh] overflow-y-auto p-6">
          {(title || description) && (
            <header className="mb-5 pr-8">
              {title ? (
                <h2 className="text-2xl font-semibold text-white">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-2 text-sm text-slate-300">{description}</p>
              ) : null}
            </header>
          )}
          <div className="space-y-4">{children}</div>
          {footer ? (
            <footer className="mt-6 flex justify-end gap-3">{footer}</footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}
