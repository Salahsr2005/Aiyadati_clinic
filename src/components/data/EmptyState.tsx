import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon = Inbox,
  image,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  image?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl p-8 text-center">
      {image ? (
        <img src={image} alt="" className="h-40 w-40 object-contain drop-shadow-lg" />
      ) : (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-500/10 text-primary-500">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="text-sm font-medium">{title}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}