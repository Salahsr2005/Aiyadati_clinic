import { Info } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/glass/GlassCard";
import type { ReactNode } from "react";

/**
 * Honest empty state for features whose backend endpoint does not exist yet
 * (see project spec §3 — audit log, global reviews queue, notification
 * broadcast, staff-scoped user contacts/documents, admin appointment
 * override). Renders a non-blocking, clearly-labeled info card instead of
 * silently calling a dead route or rendering `undefined`.
 */
export function InfoCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="flex flex-col items-start gap-3 py-10">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-500/10 text-primary-500">
          <Info className="h-5 w-5" />
        </div>
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </GlassCard>
    </motion.div>
  );
}
