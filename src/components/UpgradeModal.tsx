import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedIn: boolean;
  upgrading: boolean;
  onUpgrade: () => Promise<void>;
};

export function UpgradeModal({ open, onOpenChange, signedIn, upgrading, onUpgrade }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>
            This course is part of Pro. Upgrade to unlock all premium learning paths and labs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {signedIn ? (
            <Button
              type="button"
              className="w-full"
              disabled={upgrading}
              onClick={() =>
                void onUpgrade()
                  .then(() => onOpenChange(false))
                  .catch(() => {})
              }
            >
              {upgrading ? "Upgrading…" : "Simulate upgrade to Pro"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Sign in to upgrade your account.</p>
          )}
          <Button type="button" variant="outline" className="w-full" asChild>
            <Link to="/pricing" onClick={() => onOpenChange(false)}>
              View pricing
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
