import { forwardRef, useEffect, useState } from "react";
import { Check, CheckCircle2, Lightbulb, Loader2, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommandBlock } from "@/components/CommandBlock";
import { cn } from "@/lib/utils";
import type { LabGuideStep, LabStepValidation, StepFailureFeedback } from "@/lib/labGuide";

export type StepOutputState = {
  ok: boolean;
  text: string;
  feedback?: StepFailureFeedback;
};

export type StepCardProps = {
  step: LabGuideStep;
  index: number;
  shellCommand: string | null;
  /** Derived from step: command | question | other (file/port/custom). */
  mode: "command" | "question" | "other";
  isCurrent: boolean;
  isLocked: boolean;
  isPassed: boolean;
  canCheck: boolean;
  checking: boolean;
  celebrate?: boolean;
  output?: StepOutputState | null;
  onCheck: (answer?: string) => void;
  onFocusTerminal: () => void;
  onHint: () => void;
};

function fileExistsPath(v: LabStepValidation | null | undefined): string | null {
  if (!v || v.type !== "file_exists") return null;
  return v.path;
}

function portOpenNum(v: LabStepValidation | null | undefined): number | null {
  if (!v || v.type !== "port_open") return null;
  return v.port;
}

export const StepCard = forwardRef<HTMLDivElement, StepCardProps>(function StepCard(
  {
    step,
    index,
    shellCommand,
    mode,
    isCurrent,
    isLocked,
    isPassed,
    canCheck,
    checking,
    celebrate,
    output,
    onCheck,
    onFocusTerminal,
    onHint,
  },
  ref,
) {
  const hasValidation = Boolean(step.validation);
  const interactive = hasValidation && !isPassed && !isLocked;
  const fePath = fileExistsPath(step.validation);
  const po = portOpenNum(step.validation);
  const [questionInput, setQuestionInput] = useState("");

  useEffect(() => {
    if (isCurrent && mode === "question") return;
    setQuestionInput("");
  }, [isCurrent, mode, step.id]);

  const questionText = step.question?.trim() || step.title;

  return (
    <div
      ref={ref}
      onClick={(e) => {
        if (isLocked) return;
        const el = e.target as HTMLElement;
        if (el.closest("button,a,input,textarea,[role='menuitem']")) return;
        onFocusTerminal();
      }}
      className={cn(
        "rounded-xl border p-4 text-left outline-none transition-[box-shadow,border-color,transform,background-color] duration-300 focus-visible:ring-2 focus-visible:ring-primary/40",
        !isLocked && "cursor-pointer",
        isLocked && "cursor-default",
        isPassed && "border-emerald-500/25 bg-emerald-500/[0.06]",
        !isPassed &&
          isCurrent &&
          "border-primary/55 bg-primary/[0.09] shadow-[0_0_0_1px_hsl(var(--primary)/0.22),0_0_28px_-10px_hsl(var(--primary)/0.38)] ring-2 ring-primary/30",
        !isPassed && !isCurrent && !isLocked && "border-border/80 bg-card/60",
        isLocked && "border-border/50 bg-muted/20 opacity-60",
        celebrate && "motion-safe:animate-in motion-safe:zoom-in-[1.01] motion-safe:duration-500 ring-2 ring-emerald-400/35",
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            isPassed ? "bg-emerald-500/20 text-emerald-400" : isLocked ? "bg-muted text-muted-foreground" : "bg-secondary text-foreground",
          )}
        >
          {isPassed ? <Check className="h-4 w-4 stroke-[3]" /> : isLocked ? <Lock className="h-3.5 w-3.5" /> : index + 1}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Step {index + 1}</p>
            <h3 className="mt-0.5 text-sm font-semibold text-foreground">{step.title}</h3>
            {step.description ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
            ) : null}
            {step.why ? (
              <div className="mt-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-[12px] leading-relaxed text-foreground/85">
                <span className="font-semibold text-primary/90">Why: </span>
                {step.why}
              </div>
            ) : null}
          </div>

          {mode === "command" && shellCommand ? <CommandBlock command={shellCommand} /> : null}

          {mode === "question" && !isPassed ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <p className="text-[13px] font-medium leading-snug text-foreground">{questionText}</p>
              <Input
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canCheck && !checking) {
                    e.preventDefault();
                    void onCheck(questionInput);
                  }
                }}
                placeholder="Type your answer…"
                disabled={!canCheck || checking}
                className="h-9 font-mono text-[13px]"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          ) : null}

          {!shellCommand && mode !== "question" && fePath ? (
            <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
              Use the terminal to create or verify: <code className="font-mono text-foreground/90">{fePath}</code>
            </p>
          ) : null}
          {!shellCommand && mode !== "question" && po != null ? (
            <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
              Start a service listening on port <span className="font-mono text-foreground">{po}</span> inside the lab.
            </p>
          ) : null}

          {hasValidation ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
              {!isPassed ? (
                mode === "question" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={!canCheck || checking}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onCheck(questionInput);
                    }}
                  >
                    {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {checking ? "Checking…" : "Submit"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={isPassed || !canCheck || checking}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onCheck();
                    }}
                  >
                    {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {checking ? "Checking…" : "Check"}
                  </Button>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  Step completed
                </span>
              )}
              {interactive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHint();
                  }}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Hint
                </Button>
              ) : null}
            </div>
          ) : null}

          {isLocked && hasValidation ? (
            <p className="text-[12px] text-muted-foreground">Finish the previous step to unlock.</p>
          ) : null}

          {output ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5 text-[12px]",
                output.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100/90" : "border-rose-500/35 bg-rose-500/5 text-rose-100/90",
              )}
            >
              {output.ok ? (
                <>
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-90">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Result
                  </div>
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-snug">
                    {output.text}
                  </pre>
                </>
              ) : (
                <>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{output.feedback?.title ?? "Something’s not ready yet"}</span>
                  </div>
                  {output.feedback?.hint ? (
                    <p className="text-[12px] leading-relaxed text-rose-50/90">
                      <span className="mr-1" aria-hidden>
                        👉
                      </span>
                      {output.feedback.hint}
                    </p>
                  ) : null}
                  {output.text ? (
                    <details className="mt-2 text-[10px] text-rose-200/70">
                      <summary className="cursor-pointer select-none text-[10px] font-medium">Technical details</summary>
                      <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all font-mono">
                        {output.text}
                      </pre>
                    </details>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
