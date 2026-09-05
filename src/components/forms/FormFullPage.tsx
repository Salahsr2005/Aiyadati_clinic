import { X, Check } from "lucide-react";
import type { ReactNode } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FormSection {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  complete?: boolean;
}

interface FormFullPageProps {
  id: string;
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  sections: FormSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  children?: ReactNode;
  preview?: ReactNode;
  footer?: ReactNode;
}

export function FormFullPage({
  id,
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  sections,
  activeSection,
  onSectionChange,
  children,
  preview,
  footer,
}: FormFullPageProps) {
  return (
    <ModalPortal
      id={id}
      open={open}
      onClose={onClose}
      dismissOnBackdrop={false}
      backdropClassName="fixed inset-0 z-[1000] bg-background/90 backdrop-blur-xl"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed inset-0 z-[1001] flex flex-col overflow-hidden bg-background"
          >
            {/* Ambient background */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.5]">
              <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />
              <div className="absolute -bottom-40 right-0 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between gap-4 border-b border-border/40 bg-background/60 px-6 py-4 backdrop-blur-md md:px-10">
              <div className="min-w-0 flex-1">
                {eyebrow && (
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500">
                    {eyebrow}
                  </div>
                )}
                <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/50 bg-background/60 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Body */}
            <div className="relative z-10 flex flex-1 overflow-hidden">
              {/* Section navigation */}
              <aside className="hidden w-72 shrink-0 border-r border-border/40 bg-background/40 p-5 backdrop-blur-md md:block">
                <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Sections
                </div>
                <nav className="space-y-1.5">
                  {sections.map((s, idx) => {
                    const active = s.id === activeSection;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onSectionChange(s.id)}
                        className={cn(
                          "group flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all",
                          active
                            ? "border-primary-500/40 bg-primary-500/10 shadow-[0_4px_20px_-8px] shadow-primary-500/40"
                            : "border-transparent bg-background/40 hover:border-border/40 hover:bg-background/70",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition",
                            s.complete
                              ? "bg-emerald-500/20 text-emerald-500"
                              : active
                                ? "bg-primary-500/20 text-primary-500"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {s.complete ? <Check className="h-3.5 w-3.5" /> : s.icon ?? idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "truncate text-sm font-semibold",
                              active ? "text-foreground" : "text-muted-foreground/90",
                            )}
                          >
                            {s.label}
                          </div>
                          {s.description && (
                            <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted-foreground/70">
                              {s.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              {/* Content */}
              <main className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="mx-auto max-w-3xl px-5 py-8 md:px-10 md:py-10">
                  {/* Mobile section pills */}
                  <div className="mb-6 flex gap-2 overflow-x-auto md:hidden">
                    {sections.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onSectionChange(s.id)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          s.id === activeSection
                            ? "border-primary-500/40 bg-primary-500/10 text-primary-500"
                            : "border-border/40 bg-background/50 text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {children}
                </div>
              </main>

              {/* Preview */}
              {preview && (
                <aside className="hidden w-96 shrink-0 border-l border-border/40 bg-background/40 backdrop-blur-md xl:block">
                  <div className="sticky top-0 h-full overflow-y-auto custom-scrollbar p-6">
                    <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                      Live preview
                    </div>
                    {preview}
                  </div>
                </aside>
              )}
            </div>

            {/* Footer */}
            {footer && (
              <footer className="relative z-10 flex items-center justify-end gap-3 border-t border-border/40 bg-background/70 px-6 py-4 backdrop-blur-md md:px-10">
                {footer}
              </footer>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}

/* ---------------- Shared field primitives ---------------- */

export function FieldLabel({ children, hint, required }: { children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
        {required && <span className="ml-1 text-primary-500">*</span>}
      </label>
      {hint && <span className="text-[10px] text-muted-foreground/60">{hint}</span>}
    </div>
  );
}

export function FieldShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="rounded-3xl border border-border/40 bg-background/60 p-5 backdrop-blur-sm md:p-6">
        {children}
      </div>
    </section>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border/50 bg-background/70 px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/40 focus:border-primary-500/60 focus:ring-2 focus:ring-primary-500/15";
