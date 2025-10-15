import { useEffect } from "react";

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
  lg: "max-w-4xl"
};

export function Modal({
  open,
  title,
  description,
  size = "md",
  onClose,
  children,
  footer
}: ModalProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex touch-pan-y items-start justify-center overflow-y-auto bg-slate-950/80 p-4 pt-16 backdrop-blur md:items-center md:pt-0">
      <div
        className={`glass-card relative w-full ${sizeClassNames[size]} h-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl supports-[height:100dvh]:h-[calc(100dvh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] md:h-auto md:max-h-[90vh]`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
          aria-label="Venster sluiten"
        >
          X
        </button>
        <div className="flex max-h-full min-h-0 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto touch-pan-y pr-3 min-h-0">
            {(title || description) && (
              <header className="mb-5 pr-8">
                {title ? <h2 className="text-2xl font-semibold text-white">{title}</h2> : null}
                {description ? <p className="mt-2 text-sm text-slate-300">{description}</p> : null}
              </header>
            )}
            <div className="space-y-4 pb-4">{children}</div>
          </div>
          {footer ? (
            <footer className="mt-4 flex justify-end gap-3 border-t border-white/5 pt-4">
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  );
}
