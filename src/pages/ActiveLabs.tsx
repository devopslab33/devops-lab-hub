import { useEffect, useState } from "react";
import { ExternalLink, FlaskConical, PlayCircle, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fetchActiveLabs, type ActiveLabResponse } from "@/lib/labApi";

export default function ActiveLabs() {
  const { user } = useAuth();
  const [labs, setLabs] = useState<ActiveLabResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const activeLabs = await fetchActiveLabs(user.id);
        if (!cancelled) {
          setLabs(activeLabs);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <PageShell
        title="Active Labs"
        description="Track running environments, review session timers, and jump back into hands-on practice."
      >
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading active labs...
        </div>
      </PageShell>
    );
  }

  if (labs.length > 0) {
    return (
      <PageShell
        title="Active Labs"
        description="Track running environments, review session timers, and jump back into hands-on practice."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {labs.map((lab) => (
            <div key={lab.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{lab.toolName}</h2>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{lab.tool}</p>
                  <p className="mt-1 text-xs text-muted-foreground font-mono">{lab.containerName}</p>
                </div>
                <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs text-success">
                  {lab.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="mt-1 text-sm text-foreground">{new Date(lab.createdAt).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="mt-1 text-sm text-foreground">{new Date(lab.expiresAt).toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {lab.url ? (
                  <Button type="button" variant="outline" className="w-full gap-1.5" onClick={() => window.open(lab.url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="h-4 w-4" />
                    Open App
                  </Button>
                ) : null}
                <Button asChild className="w-full flex-1">
                  <Link to={`/?sessionId=${lab.id}`}>Reconnect Terminal</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Active Labs"
      description="Track running environments, review session timers, and jump back into hands-on practice."
    >
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FlaskConical className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">No active labs right now</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          Launch a lab from the dashboard to see its runtime, timer, and quick access details here.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/60 p-4 text-left">
            <Timer className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-foreground">Live runtime visibility</p>
            <p className="mt-1 text-xs text-muted-foreground">Monitor active sessions and remaining time limits.</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-4 text-left">
            <PlayCircle className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-foreground">Fast re-entry</p>
            <p className="mt-1 text-xs text-muted-foreground">Return to the dashboard and launch a new practice environment.</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-4 text-left">
            <FlaskConical className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-foreground">Focused operations view</p>
            <p className="mt-1 text-xs text-muted-foreground">Keep lab management separate from the discovery catalog.</p>
          </div>
        </div>

        <Button asChild className="mt-8">
          <Link to="/">Go to Dashboard</Link>
        </Button>
      </div>
    </PageShell>
  );
}
