import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type StageSuccessModalProps = {
  open: boolean;
  hasNextStage: boolean;
  xpReward?: number;
  onContinue: () => void;
};

export function StageSuccessModal({ open, hasNextStage, xpReward = 10, onContinue }: StageSuccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => next === false && onContinue()}>
      <DialogContent
        className="max-w-sm border-border/80 bg-card sm:max-w-sm"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 text-center sm:text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl" aria-hidden>
            🎉
          </div>
          <DialogTitle className="text-lg">Stage completed!</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
            You successfully completed this step.
          </DialogDescription>
          {xpReward > 0 ? (
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-amber-400/95">
              <Sparkles className="h-4 w-4" aria-hidden />+{xpReward} XP
            </p>
          ) : null}
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button type="button" className="w-full sm:w-auto" onClick={onContinue}>
            {hasNextStage ? "Continue to next stage" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
