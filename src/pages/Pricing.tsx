import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

const freeFeatures = ["Free courses", "Community labs", "Progress on free paths"];
const proFeatures = ["All Pro courses", "Docker & advanced labs", "Priority-style experience (simulated)"];

export default function Pricing() {
  const { user } = useAuth();
  const { isPro, upgradeToProSimulated, refresh } = useSubscription();
  const [busy, setBusy] = useState(false);

  const handleUpgrade = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      await upgradeToProSimulated();
      await refresh();
      toast.success("You are now on Pro (simulated).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Pricing" description="Simple plans while billing integration is on the roadmap.">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Free</h2>
            <Badge variant="outline">Free</Badge>
          </div>
          <p className="mt-1 text-3xl font-bold text-foreground">$0</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            {freeFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-8 w-full">
            <Link to="/courses">Browse free courses</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-primary/40 bg-gradient-to-b from-card to-primary/5 p-6 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.35)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Pro</h2>
            <Badge className="bg-primary text-primary-foreground">Pro</Badge>
          </div>
          <p className="mt-1 text-3xl font-bold text-foreground">Simulated</p>
          <p className="text-xs text-muted-foreground">Payment integration coming later — upgrade is instant for testing.</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            {proFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-foreground/90">{f}</span>
              </li>
            ))}
          </ul>
          {isPro ? (
            <p className="mt-8 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">You are on Pro.</p>
          ) : (
            <Button className="mt-8 w-full" disabled={!user || busy} onClick={() => void handleUpgrade()}>
              {!user ? "Sign in to upgrade" : busy ? "Upgrading…" : "Upgrade to Pro (simulated)"}
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
