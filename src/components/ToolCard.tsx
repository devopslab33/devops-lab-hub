import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock3, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ToolCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  plan: "Free" | "Pro";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  timeLimit: string;
  onLaunch: () => void;
}

const difficultyBadgeClass: Record<ToolCardProps["difficulty"], string> = {
  Beginner: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  Intermediate: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  Advanced: "border-rose-500/40 text-rose-300 bg-rose-500/10",
};

export function ToolCard({ name, description, icon: Icon, iconColor, plan, difficulty, timeLimit, onLaunch }: ToolCardProps) {
  const isPro = plan === "Pro";

  return (
    <div
      className={`group rounded-xl border bg-card p-5 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 ${
        isPro
          ? "border-pro/35 hover:border-pro/60 hover:shadow-[0_0_30px_hsl(var(--pro)/0.22)]"
          : "border-border hover:border-primary/30 hover:shadow-[0_0_28px_hsl(var(--primary)/0.16)]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex items-center justify-center w-11 h-11 rounded-lg bg-secondary ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge
            variant="outline"
            className={
              plan === "Pro"
                ? "border-pro/40 text-pro bg-pro/10 text-xs"
                : "border-success/40 text-success bg-success/10 text-xs"
            }
          >
            {plan}
          </Badge>
          <Badge variant="outline" className={`text-xs ${difficultyBadgeClass[difficulty]}`}>
            {difficulty}
          </Badge>
          <Badge variant="outline" className="text-xs border-border/60 text-muted-foreground bg-secondary/40 gap-1">
            <Clock3 className="w-3 h-3" />
            {timeLimit}
          </Badge>
        </div>
      </div>
      <div className="flex-1">
        <h3 className="text-foreground font-semibold text-base">{name}</h3>
        <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{description}</p>
      </div>
      <Button
        onClick={onLaunch}
        className={`w-full gap-2 transition-all ${
          isPro
            ? "bg-gradient-to-r from-pro/90 to-primary text-primary-foreground hover:from-pro hover:to-primary shadow-[0_0_20px_hsl(var(--pro)/0.25)]"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
        size="sm"
      >
        <Play className="w-3.5 h-3.5" />
        Launch Lab
      </Button>
    </div>
  );
}
