import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildStepFailureFeedback,
  getLabGuide,
  getStepInteraction,
  getStepShellCommand,
  type LabGuideStep,
  type LabToolKey,
} from "@/lib/labGuide";
import { ListOrdered } from "lucide-react";
import { fetchLabProgress, postLabStepValidation } from "@/lib/labApi";
import { toast } from "sonner";
import type { StepOutputState } from "@/components/StepCard";
import { OnboardingTooltip, readLabOnboardingSeen } from "@/components/OnboardingTooltip";
import { SuccessBanner } from "@/components/SuccessBanner";
import { StageView } from "@/components/StageView";
import { StageSuccessModal } from "@/components/StageSuccessModal";

type LabInstructionsPanelProps = {
  toolKey: LabToolKey;
  sessionId: string;
  userId: string;
  courseId?: string;
  courseLabId?: string;
  className?: string;
  onRequestTerminalFocus?: () => void;
  onStepHint?: (stepIndex: number) => void;
  hasNextLab?: boolean;
  nextLabName?: string;
  onTryNextLab?: () => void | Promise<void>;
};

function priorValidatedStepsSatisfied(steps: LabGuideStep[], index: number, passed: Set<string>) {
  for (let j = 0; j < index; j++) {
    const s = steps[j];
    if (!s?.validation) continue;
    if (!passed.has(s.id)) return false;
  }
  return true;
}

/** Slot index 0..n-1 into validated steps only. */
function findFirstIncompleteStageSlot(steps: LabGuideStep[], passed: Set<string>): number {
  const slots = steps.map((s, i) => (s.validation ? i : -1)).filter((i): i is number => i >= 0);
  if (!slots.length) return 0;
  for (let k = 0; k < slots.length; k++) {
    const idx = slots[k];
    const step = steps[idx];
    if (!priorValidatedStepsSatisfied(steps, idx, passed)) return k;
    if (!passed.has(step.id)) return k;
  }
  return slots.length - 1;
}

export function LabInstructionsPanel({
  toolKey,
  sessionId,
  userId,
  courseId,
  courseLabId,
  className,
  onRequestTerminalFocus,
  onStepHint,
  hasNextLab = false,
  nextLabName,
  onTryNextLab,
}: LabInstructionsPanelProps) {
  const g = useMemo(() => getLabGuide(toolKey), [toolKey]);
  const steps = g.steps;

  const stageSlotIndices = useMemo(
    () => steps.map((s, i) => (s.validation ? i : -1)).filter((i): i is number => i >= 0),
    [steps],
  );
  const totalStages = stageSlotIndices.length;

  const [passed, setPassed] = useState<Set<string>>(() => new Set());
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, StepOutputState>>({});
  /** Index into stage slots (0 .. totalStages-1). */
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [showStageSuccess, setShowStageSuccess] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const stageHydratedSync = useRef(false);

  useEffect(() => {
    setShowOnboarding(false);
    stageHydratedSync.current = false;
  }, [sessionId, toolKey]);

  const stepsWithValidation = useMemo(() => steps.filter((s) => s.validation), [steps]);
  const allValidatedDone = useMemo(
    () => stepsWithValidation.length > 0 && stepsWithValidation.every((s) => passed.has(s.id)),
    [stepsWithValidation, passed],
  );

  /** After closing the last stage modal, reveal full-lab completion UI (avoid flashing before modal). */
  const labCompleteReveal = allValidatedDone && !showStageSuccess;

  useEffect(() => {
    let cancelled = false;
    setOutputs({});
    setLoadingId(null);
    setPassed(new Set());
    setProgressHydrated(false);
    setCurrentStageIndex(0);
    setShowStageSuccess(false);
    stageHydratedSync.current = false;

    if (!userId) {
      setProgressHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const { completedSteps } = await fetchLabProgress(sessionId, userId);
        if (cancelled) return;
        setPassed(new Set(completedSteps));
      } catch {
        if (!cancelled) setPassed(new Set());
      } finally {
        if (!cancelled) setProgressHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, userId, toolKey, courseId, courseLabId]);

  useEffect(() => {
    if (!progressHydrated || stageHydratedSync.current) return;
    stageHydratedSync.current = true;
    setCurrentStageIndex(findFirstIncompleteStageSlot(steps, passed));
  }, [progressHydrated, steps, passed]);

  useEffect(() => {
    if (!progressHydrated) return;
    if (readLabOnboardingSeen()) return;
    setShowOnboarding(true);
  }, [progressHydrated]);

  const activeGuideIndex = stageSlotIndices[currentStageIndex] ?? stageSlotIndices[0] ?? 0;
  const activeStep = steps[activeGuideIndex];

  const canCheck = useCallback(
    (step: LabGuideStep, index: number) => {
      if (!step.validation) return false;
      if (passed.has(step.id)) return false;
      return priorValidatedStepsSatisfied(steps, index, passed);
    },
    [passed, steps],
  );

  const runValidation = useCallback(
    async (step: LabGuideStep, index: number, answer?: string) => {
      if (!step.validation || !canCheck(step, index)) return;

      setLoadingId(step.id);
      try {
        const course = courseId && courseLabId ? { courseId, courseLabId } : undefined;
        const answerPayload = step.interactionType === "question" ? (answer ?? "") : undefined;
        const result = await postLabStepValidation(sessionId, step.id, userId, course, answerPayload);
        if (result.success) {
          setOutputs((prev) => ({
            ...prev,
            [step.id]: { ok: true, text: result.output || "(no output)", feedback: undefined },
          }));
          setPassed((prev) => new Set(prev).add(step.id));
          setShowStageSuccess(true);
        } else {
          const apiTitle = result.message?.trim();
          const apiHint = result.hint?.trim();
          const feedback =
            apiTitle || apiHint
              ? {
                  title: apiTitle || "Not quite yet",
                  hint: apiHint || undefined,
                }
              : buildStepFailureFeedback(step, result.output || "");
          setOutputs((prev) => ({
            ...prev,
            [step.id]: {
              ok: false,
              text: result.output || "",
              feedback,
            },
          }));
          toast.error(feedback.title);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Validation failed";
        toast.error(msg);
        const feedback = buildStepFailureFeedback(step, msg);
        setOutputs((prev) => ({
          ...prev,
          [step.id]: { ok: false, text: msg, feedback },
        }));
      } finally {
        setLoadingId(null);
      }
    },
    [canCheck, courseId, courseLabId, sessionId, userId],
  );

  const handleContinueStage = useCallback(() => {
    setShowStageSuccess(false);
    setCurrentStageIndex((idx) => Math.min(idx + 1, Math.max(0, totalStages - 1)));
  }, [totalStages]);

  const focusTerminal = useCallback(() => {
    onRequestTerminalFocus?.();
  }, [onRequestTerminalFocus]);

  const hintForStep = useCallback(
    (stepIndex: number) => {
      if (onStepHint) onStepHint(stepIndex);
      else toast.message("Hints will appear here as you progress.");
    },
    [onStepHint],
  );

  const shell = activeStep ? getStepShellCommand(activeStep) : null;
  const interaction = activeStep ? getStepInteraction(activeStep) : "other";
  const mode = interaction === "question" ? "question" : interaction === "command" ? "command" : "other";
  const busy = activeStep ? loadingId === activeStep.id : false;
  const out = activeStep ? outputs[activeStep.id] ?? null : null;
  const canSubmit = activeStep ? canCheck(activeStep, activeGuideIndex) : false;

  const hasNextStage = currentStageIndex < totalStages - 1;

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 flex-col rounded-xl border border-border/80 bg-card/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/80 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ListOrdered className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lab stages</p>
          <h2 className="truncate text-sm font-semibold text-foreground">{g.instructionTitle}</h2>
        </div>
      </div>

      {labCompleteReveal ? (
        <div className="shrink-0 border-b border-border/60 px-3 pb-3 pt-2">
          <SuccessBanner
            show
            hasNextLab={hasNextLab}
            nextLabName={nextLabName}
            onTryNextLab={onTryNextLab}
            className="text-left sm:text-center"
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {!progressHydrated ? (
          <div className="flex flex-1 items-center justify-center px-6 py-12 text-sm text-muted-foreground">
            Loading progress…
          </div>
        ) : totalStages === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 py-12 text-sm text-muted-foreground">
            No stages configured for this lab.
          </div>
        ) : labCompleteReveal ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              You’ve completed every stage in this lab.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            {activeStep ? (
              <StageView
                key={activeStep.id}
                stageNumber={currentStageIndex + 1}
                totalStages={totalStages}
                instructionTitle={g.instructionTitle}
                step={activeStep}
                mode={mode}
                shellCommand={shell}
                output={out}
                checking={busy}
                canSubmit={canSubmit}
                onSubmit={(answer?: string) => void runValidation(activeStep, activeGuideIndex, answer)}
                onHint={() => hintForStep(activeGuideIndex)}
                onFocusTerminal={focusTerminal}
              />
            ) : null}
          </div>
        )}
      </div>

      <StageSuccessModal
        open={showStageSuccess}
        hasNextStage={hasNextStage}
        xpReward={10}
        onContinue={handleContinueStage}
      />

      <OnboardingTooltip open={showOnboarding} onDismiss={() => setShowOnboarding(false)} />
    </aside>
  );
}
