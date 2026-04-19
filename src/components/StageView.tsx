import { useEffect, useState } from "react";
import { CheckCircle2, Lightbulb, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommandBlock } from "@/components/CommandBlock";
import { cn } from "@/lib/utils";
import type { LabGuideStep, LabStepValidation, StepFailureFeedback } from "@/lib/labGuide";
import type { StepOutputState } from "@/components/StepCard";

export type StageViewProps = {
  stageNumber: number;
  totalStages: number;
  instructionTitle: string;
  step: LabGuideStep;
  mode: "command" | "question" | "other";
  shellCommand: string | null;
  output: StepOutputState | null;
  checking: boolean;
  canSubmit: boolean;
  onSubmit: (answer?: string) => void;
  onHint: () => void;
  /** Focus terminal when learner taps the stage (not inputs/buttons). */
  onFocusTerminal: () => void;
  className?: string;
};

function fileExistsPath(v: LabStepValidation | null | undefined): string | null {
  if (!v || v.type !== "file_exists") return null;
  return v.path;
}

function portOpenNum(v: LabStepValidation | null | undefined): number | null {
  if (!v || v.type !== "port_open") return null;
  return v.port;
}

export function StageView({
  stageNumber,
  totalStages,
  instructionTitle,
  step,
  mode,
  shellCommand,
  output,
  checking,
  canSubmit,
  onSubmit,
  onHint,
  onFocusTerminal,
  className,
}: StageViewProps) {
  const fePath = fileExistsPath(step.validation);
  const po = portOpenNum(step.validation);
  const hasValidation = Boolean(step.validation);
  const questionText = step.question?.trim() || step.title;
  const [questionInput, setQuestionInput] = useState("");

  useEffect(() => {
    setQuestionInput("");
  }, [step.id]);

  return (
    <div
      className={cn(
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-[1.01] motion-safe:duration-300",
        className,
      )}
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("button,a,input,textarea,[role='dialog']")) return;
        onFocusTerminal();
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{instructionTitle}</p>
          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
            Stage <span className="font-semibold text-foreground">{stageNumber}</span> of{" "}
            <span className="font-semibold text-foreground">{totalStages}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">{step.title}</h3>
          {step.description ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
          ) : null}
          {step.why ? (
            <div className="mt-3 rounded-lg border border-border/50 bg-muted/25 px-3 py-2.5 text-[12px] leading-relaxed text-foreground/90">
              <span className="font-semibold text-primary/90">Why: </span>
              {step.why}
            </div>
          ) : null}
        </div>

        {mode === "command" && shellCommand ? <CommandBlock command={shellCommand} /> : null}

        {mode === "question" ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13px] font-medium leading-snug text-foreground">{questionText}</p>
            <Input
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit && !checking) {
                  e.preventDefault();
                  void onSubmit(questionInput);
                }
              }}
              placeholder="Type your answer…"
              disabled={!canSubmit || checking}
              className="h-10 font-mono text-[13px]"
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
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {mode === "question" ? (
              <Button
                type="button"
                size="default"
                className="gap-2"
                disabled={!canSubmit || checking}
                onClick={(e) => {
                  e.stopPropagation();
                  void onSubmit(questionInput);
                }}
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {checking ? "Checking…" : "Submit"}
              </Button>
            ) : (
              <Button
                type="button"
                size="default"
                className="gap-2"
                disabled={!canSubmit || checking}
                onClick={(e) => {
                  e.stopPropagation();
                  void onSubmit();
                }}
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {checking ? "Checking…" : "Check"}
              </Button>
            )}
            <Button type="button" variant="outline" size="default" className="gap-2" onClick={(e) => {
              e.stopPropagation();
              onHint();
            }}>
              <Lightbulb className="h-4 w-4" />
              Hint
            </Button>
          </div>
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
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-snug">
                  {output.text}
                </pre>
              </>
            ) : (
              <FailureBlock feedback={output.feedback} technical={output.text} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FailureBlock({ feedback, technical }: { feedback?: StepFailureFeedback; technical: string }) {
  return (
    <>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{feedback?.title ?? "Something’s not ready yet"}</span>
      </div>
      {feedback?.hint ? (
        <p className="text-[12px] leading-relaxed text-rose-50/90">
          <span className="mr-1" aria-hidden>
            👉
          </span>
          {feedback.hint}
        </p>
      ) : null}
      {technical ? (
        <details className="mt-2 text-[10px] text-rose-200/70">
          <summary className="cursor-pointer select-none text-[10px] font-medium">Technical details</summary>
          <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all font-mono">{technical}</pre>
        </details>
      ) : null}
    </>
  );
}
