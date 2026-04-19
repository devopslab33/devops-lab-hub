import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, RotateCcw, Square, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LabHeaderProps = {
  labTitle: string;
  toolIcon: LucideIcon;
  secondsLeft: number;
  formatRemaining: (s: number) => string;
  resetting: boolean;
  destroying: boolean;
  onResetLab: () => Promise<void> | void;
  onDestroy: () => Promise<void> | void;
};

export function LabHeader({
  labTitle,
  toolIcon: Icon,
  secondsLeft,
  formatRemaining,
  resetting,
  destroying,
  onResetLab,
  onDestroy,
}: LabHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card/90 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{labTitle}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/35 bg-emerald-500/10 text-[11px] text-emerald-400">
              Running
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 font-mono text-sm tabular-nums",
            secondsLeft < 300 && secondsLeft > 0 && "border-destructive/30 bg-destructive/5",
          )}
        >
          <Timer className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className={cn("font-semibold", secondsLeft < 300 ? "text-destructive" : "text-foreground")}>
            {formatRemaining(secondsLeft)}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="shrink-0 border-border/80" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              disabled={resetting}
              onClick={() => {
                void onResetLab();
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {resetting ? "Resetting…" : "Reset lab"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={resetting}
              onClick={() => {
                toast.message("Extend time is coming soon.");
              }}
            >
              Extend time
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={destroying}
              onClick={() => {
                void onDestroy();
              }}
            >
              <Square className="mr-2 h-4 w-4" />
              {destroying ? "Destroying…" : "Destroy lab"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
