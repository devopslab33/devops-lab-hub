import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Lock } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { fetchCoursesList, type CourseSummary } from "@/lib/labApi";
import { UpgradeModal } from "@/components/UpgradeModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Courses() {
  const { user } = useAuth();
  const { isPro, upgradeToProSimulated, refresh } = useSubscription();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchCoursesList(user?.id);
        if (!cancelled) setCourses(data.courses);
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const courseLocked = (c: CourseSummary) => (c.plan ?? "free") === "pro" && !isPro;

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await upgradeToProSimulated();
      await refresh();
      const data = await fetchCoursesList(user?.id);
      setCourses(data.courses);
      toast.success("You are now on Pro.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upgrade failed");
      throw e;
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <PageShell
      title="Courses"
      description="Structured learning paths. Complete labs in order to unlock the next one."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Your plan</span>
          <Badge variant={isPro ? "default" : "outline"}>{isPro ? "Pro" : "Free"}</Badge>
        </div>
        {!isPro ? (
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link to="/pricing">Upgrade to Pro</Link>
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading courses…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => {
            const locked = courseLocked(c);
            const inner = (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-foreground">{c.title}</h2>
                    <Badge variant="outline" className="text-[10px]">
                      {(c.plan ?? "free") === "pro" ? "Pro" : "Free"}
                    </Badge>
                  </div>
                  {c.description ? (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">{c.labs?.length ?? 0} labs</p>
                  {user?.id && typeof c.percent === "number" && !locked ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span className="tabular-nums text-foreground">{c.percent}%</span>
                      </div>
                      <Progress value={c.percent} className="h-2" />
                    </div>
                  ) : null}
                </div>
              </div>
            );

            return (
              <div
                key={c.id}
                className={cn(
                  "group relative rounded-xl border border-border bg-card p-5 transition-colors",
                  !locked && "hover:border-primary/35 hover:bg-card/90",
                )}
              >
                {locked ? (
                  <>
                    <div className="pointer-events-none select-none opacity-[0.22] blur-[0.5px]">{inner}</div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/80 p-4 backdrop-blur-[2px]">
                      <Lock className="h-8 w-8 text-muted-foreground" />
                      <p className="text-center text-sm font-medium text-foreground">Pro course</p>
                      <Button type="button" size="sm" onClick={() => setUpgradeOpen(true)}>
                        Upgrade to Pro
                      </Button>
                    </div>
                  </>
                ) : (
                  <Link to={`/courses/${encodeURIComponent(c.id)}`} className="block">
                    {inner}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        signedIn={Boolean(user)}
        upgrading={upgrading}
        onUpgrade={handleUpgrade}
      />
    </PageShell>
  );
}
