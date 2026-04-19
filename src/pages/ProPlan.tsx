import { CheckCircle2, Crown, Sparkles, Zap } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";

const proFeatures = [
  "Longer lab runtimes for heavyweight tools like Kubernetes and Jenkins.",
  "Higher RAM allocations for orchestration, CI/CD, and observability stacks.",
  "Premium catalog access with advanced scenarios and richer provisioning profiles.",
];

export default function ProPlan() {
  return (
    <PageShell
      title="Pro Plan"
      description="Upgrade paths and premium capabilities for advanced DevOps learning environments."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-pro/30 bg-card p-8 shadow-[0_0_30px_hsl(var(--pro)/0.12)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pro/15 text-pro">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Professional labs for serious practice</h2>
              <p className="text-sm text-muted-foreground">Built for high-value tools that need more time and more compute.</p>
            </div>
          </div>

          <div className="space-y-3">
            {proFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/40 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pro" />
                <p className="text-sm text-foreground">{feature}</p>
              </div>
            ))}
          </div>

          <Button className="mt-6 bg-gradient-to-r from-pro to-primary text-primary-foreground hover:opacity-95">
            Upgrade to Pro
          </Button>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <Zap className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Provisioning advantage</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pro labs are optimized for heavier backend workloads and longer session windows.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Sparkles className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Premium catalog growth</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              As new advanced tools are added, the Pro plan remains the destination for deep-dive practice.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
