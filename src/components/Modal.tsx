import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur sm:p-6">
      <div className="flex min-h-full items-start justify-center py-2 sm:items-center sm:py-6">
        <div
          className={`glass-card relative w-full ${sizeClassNames[size]} max-h-[calc(100dvh-2rem)] rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl sm:max-h-[90vh]`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:border-axoft-400 hover:text-axoft-200 focus:outline-none focus:ring-2 focus:ring-axoft-500/40"
            aria-label="Venster sluiten"
          >
            X
          </button>
          <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-h-[90vh]">
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
    </div>,
    document.body
  );
}
