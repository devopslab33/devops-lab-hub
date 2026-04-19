import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, PartyPopper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SuccessBannerProps = {
  show: boolean;
  hasNextLab: boolean;
  nextLabName?: string;
  onTryNextLab?: () => void | Promise<void>;
  className?: string;
};

export function SuccessBanner({ show, hasNextLab, nextLabName, onTryNextLab, className }: SuccessBannerProps) {
  const navigate = useNavigate();
  const [nextBusy, setNextBusy] = useState(false);

  if (!show) return null;

  const runNext = async () => {
    if (!onTryNextLab) return;
    setNextBusy(true);
    try {
      await onTryNextLab();
    } finally {
      setNextBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.12] via-card to-card px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" aria-hidden />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <PartyPopper className="h-5 w-5 text-emerald-400" aria-hidden />
          <span>Lab completed!</span>
          <Sparkles className="h-4 w-4 text-amber-400/90" aria-hidden />
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">Great work — you finished every step in this lab.</p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {hasNextLab && onTryNextLab ? (
            <div className="flex flex-col items-center gap-1 sm:items-stretch">
              <Button type="button" className="gap-1.5 sm:min-w-[10rem]" disabled={nextBusy} onClick={() => void runNext()}>
                {nextBusy ? "Starting…" : "Try next lab"}
              </Button>
              {nextLabName && !nextBusy ? (
                <span className="text-center text-[11px] text-muted-foreground">{nextLabName}</span>
              ) : null}
            </div>
          ) : null}
          <Button type="button" variant="outline" className="gap-1.5 border-border/80 sm:min-w-[10rem]" onClick={() => navigate("/courses")}>
            <BookOpen className="h-4 w-4" />
            View courses
          </Button>
        </div>
      </div>
    </div>
  );
}
