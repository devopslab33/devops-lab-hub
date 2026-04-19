import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** localStorage key; value `"true"` means the user dismissed the onboarding. */
export const LAB_ONBOARDING_SEEN_KEY = "lab_onboarding_seen";

export function readLabOnboardingSeen(): boolean {
  try {
    return window.localStorage.getItem(LAB_ONBOARDING_SEEN_KEY) === "true";
  } catch {
    return true;
  }
}

export function writeLabOnboardingSeen(): void {
  try {
    window.localStorage.setItem(LAB_ONBOARDING_SEEN_KEY, "true");
  } catch {
    /* ignore */
  }
}

type OnboardingTooltipProps = {
  open: boolean;
  onDismiss: () => void;
};

export function OnboardingTooltip({ open, onDismiss }: OnboardingTooltipProps) {
  const finish = () => {
    writeLabOnboardingSeen();
    onDismiss();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish();
      }}
    >
      <DialogContent className="max-w-md border-border/80 bg-card sm:max-w-md" aria-describedby="lab-onboarding-desc">
        <DialogHeader>
          <DialogTitle className="text-base">How this lab works</DialogTitle>
          <DialogDescription id="lab-onboarding-desc" className="text-left text-[13px] leading-relaxed">
            Follow this flow for each step:
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2.5 text-[13px] leading-relaxed text-foreground/90">
          <li className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              👉
            </span>
            <span>Click a step on the left to focus the terminal.</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              👉
            </span>
            <span>Copy the command (when shown) and paste it in the terminal.</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0" aria-hidden>
              👉
            </span>
            <span>Press Enter to run it, then click Check to validate.</span>
          </li>
        </ul>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" onClick={finish}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
