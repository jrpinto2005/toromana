import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { urgencyByLevel, type UrgencyLevel } from "@/modules/notifications";

export function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  const urgency = urgencyByLevel(level);
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", urgency.badgeClass)}>
      <span aria-hidden>{urgency.emoji}</span>
      {urgency.label}
    </Badge>
  );
}
