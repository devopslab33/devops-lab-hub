import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { LabTerminal } from "@/components/LabTerminal";
import { LabInstructionsPanel } from "@/components/LabInstructionsPanel";
import { LabHeader } from "@/components/LabHeader";
import { getHintLevels, type LabToolKey } from "@/lib/labGuide";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Live countdown shown in header — HH:MM:SS */
function formatCountdownHms(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hPart = h > 99 ? String(h) : pad(h);
  return `${hPart}:${pad(m)}:${pad(s)}`;
}

interface ActiveLabPanelProps {
  labTitle: string;
  toolKey: LabToolKey;
  toolIcon: LucideIcon;
  containerName: string;
  terminalUrl: string;
  appUrl: string | null;
  sessionId: string;
  userId: string;
  courseId?: string;
  courseLabId?: string;
  /** Accepted for compatibility with callers; unused in this chrome. */
  publishedContainerPorts?: number[];
  expiresAt: string;
  onDestroy: () => Promise<void> | void;
  onResetLab: () => Promise<void> | void;
  hasNextLab?: boolean;
  nextLabName?: string;
  onTryNextLab?: () => void | Promise<void>;
}

export function ActiveLabPanel({
  labTitle,
  toolKey,
  toolIcon: Icon,
  containerName,
  terminalUrl,
  sessionId,
  userId,
  courseId,
  courseLabId,
  expiresAt,
  onDestroy,
  onResetLab,
  hasNextLab = false,
  nextLabName,
  onTryNextLab,
}: ActiveLabPanelProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [destroying, setDestroying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"steps" | "terminal">("steps");
  const [terminalFocusNonce, setTerminalFocusNonce] = useState(0);
  const destroyingRef = useRef(false);

  const hintLevels = useMemo(() => getHintLevels(toolKey), [toolKey]);
  const maxHints = hintLevels.length;

  useEffect(() => {
    destroyingRef.current = destroying;
  }, [destroying]);

  useEffect(() => {
    setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  }, [expiresAt]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const bumpTerminalFocus = useCallback(() => {
    setTerminalFocusNonce((n) => n + 1);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobilePanel("terminal");
    }
  }, []);

  const onStepHint = useCallback(
    (stepIndex: number) => {
      if (maxHints === 0) {
        toast.message("No hints available for this lab yet.");
        return;
      }
      const idx = Math.min(Math.max(stepIndex, 0), maxHints - 1);
      const level = hintLevels[idx];
      if (!level) {
        toast.message("No hint available for this step.");
        return;
      }
      const detail = level.lines.length ? `\n${level.lines.join("\n")}` : "";
      toast.message(`Hint: ${level.title}${detail}`, { duration: 9000 });
    },
    [hintLevels, maxHints],
  );

  const handleResetLab = useCallback(async () => {
    setResetting(true);
    try {
      await onResetLab();
    } finally {
      setResetting(false);
    }
  }, [onResetLab]);

  const handleDestroy = useCallback(async () => {
    destroyingRef.current = true;
    setDestroying(true);
    try {
      await onDestroy();
    } finally {
      setDestroying(false);
      destroyingRef.current = false;
    }
  }, [onDestroy]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_0_40px_-16px_hsl(190_90%_45%/0.18)] max-h-[calc(100dvh-4.5rem)] min-h-[min(560px,85dvh)]">
      <LabHeader
        labTitle={labTitle}
        toolIcon={Icon}
        secondsLeft={secondsLeft}
        formatRemaining={formatCountdownHms}
        resetting={resetting}
        destroying={destroying}
        onResetLab={handleResetLab}
        onDestroy={handleDestroy}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-stretch lg:gap-5 lg:p-5">
        <div className="flex shrink-0 gap-2 lg:hidden">
          <Button
            type="button"
            variant={mobilePanel === "steps" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setMobilePanel("steps")}
          >
            Steps
          </Button>
          <Button
            type="button"
            variant={mobilePanel === "terminal" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setMobilePanel("terminal")}
          >
            Terminal
          </Button>
        </div>

        <div
          className={cn(
            "flex min-h-0 min-w-0 lg:w-[35%] lg:max-w-[min(100%,440px)] lg:shrink-0",
            mobilePanel !== "steps" && "hidden lg:flex",
          )}
        >
          <LabInstructionsPanel
            toolKey={toolKey}
            sessionId={sessionId}
            userId={userId}
            courseId={courseId}
            courseLabId={courseLabId}
            onRequestTerminalFocus={bumpTerminalFocus}
            onStepHint={onStepHint}
            hasNextLab={hasNextLab}
            nextLabName={nextLabName}
            onTryNextLab={onTryNextLab}
            className="h-full min-h-[min(320px,50dvh)] w-full lg:min-h-0"
          />
        </div>

        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", mobilePanel !== "terminal" && "hidden lg:flex")}>
          <LabTerminal
            wsUrl={terminalUrl}
            containerName={containerName}
            focusNonce={terminalFocusNonce}
            className="min-h-[min(280px,48dvh)] flex-1 lg:min-h-0"
          />
        </div>
      </div>
    </div>
  );
}
