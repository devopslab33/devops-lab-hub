import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ToolCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  tier: "Free" | "Pro";
  onLaunch: () => void;
}

export function ToolCard({ name, description, icon: Icon, iconColor, tier, onLaunch }: ToolCardProps) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 card-hover flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`flex items-center justify-center w-11 h-11 rounded-lg bg-secondary ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <Badge
          variant="outline"
          className={
            tier === "Pro"
              ? "border-pro/40 text-pro bg-pro/10 text-xs"
              : "border-success/40 text-success bg-success/10 text-xs"
          }
        >
          {tier}
        </Badge>
      </div>
      <div className="flex-1">
        <h3 className="text-foreground font-semibold text-base">{name}</h3>
        <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{description}</p>
      </div>
      <Button
        onClick={onLaunch}
        className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        size="sm"
      >
        <Play className="w-3.5 h-3.5" />
        Launch Lab
      </Button>
    </div>
  );
}
