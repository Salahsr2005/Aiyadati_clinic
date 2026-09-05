import { X } from "lucide-react";
import type { ReactNode } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function FormModal({
  id,
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-md",
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <ModalPortal
      id={id}
      open={open}
      onClose={onClose}
      backdropClassName="fixed inset-0 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className={`glass-strong w-full ${width} rounded-3xl p-6`}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="glass grid h-8 w-8 place-items-center rounded-full"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </ModalPortal>
  );
}
