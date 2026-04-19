import { cn } from "@/lib/utils";
import type { HintLevel } from "@/lib/labGuide";
import { Lightbulb } from "lucide-react";

type HintsPanelProps = {
  levels: HintLevel[];
  revealedCount: number;
  className?: string;
};

export function HintsPanel({ levels, revealedCount, className }: HintsPanelProps) {
  if (revealedCount <= 0) return null;

  const visible = levels.slice(0, Math.min(revealedCount, levels.length));

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent shadow-sm",
        className,
      )}
      aria-label="Hints"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/80 px-4 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hints</p>
          <p className="text-xs text-foreground/90">Reveal one level at a time from the toolbar.</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3">
        {visible.map((level, idx) => (
          <div key={`${level.title}-${idx}`} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">{level.title}</p>
            <ul className="space-y-1.5 font-mono text-[13px] leading-relaxed text-foreground/90">
              {level.lines.map((line, i) => (
                <li key={i} className="border-l-2 border-amber-500/30 pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
