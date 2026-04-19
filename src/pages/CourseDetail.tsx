import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createSearchParams, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { fetchCourseById, fetchCourseProgress, type CourseProgressPayload, type CourseSummary } from "@/lib/labApi";
import { UpgradeModal } from "@/components/UpgradeModal";
import { toast } from "sonner";

function buildLaunchSearch(courseId: string, labId: string, tool: string) {
  return createSearchParams({
    launchCourse: "1",
    courseId,
    courseLabId: labId,
    tool,
  }).toString();
}

export default function CourseDetail() {
  const { courseId: routeCourseId = "" } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { isPro, upgradeToProSimulated, refresh } = useSubscription();
  const [course, setCourse] = useState<CourseSummary | null>(null);
  const [progress, setProgress] = useState<CourseProgressPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const paywall = (course?.plan ?? "free") === "pro" && !isPro;

  const load = useCallback(async () => {
    if (!routeCourseId) return;
    setLoading(true);
    try {
      const { course: c } = await fetchCourseById(routeCourseId);
      setCourse(c);
      if (user?.id && ((c.plan ?? "free") !== "pro" || isPro)) {
        const p = await fetchCourseProgress(routeCourseId, user.id);
        setProgress(p);
      } else {
        setProgress(null);
      }
    } catch {
      setCourse(null);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [routeCourseId, user?.id, isPro]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await upgradeToProSimulated();
      await refresh();
      await load();
      toast.success("You are now on Pro.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upgrade failed");
      throw e;
    } finally {
      setUpgrading(false);
    }
  };

  const firstActionable = useMemo(() => {
    if (!course?.labs?.length) return null;
    if (!progress?.labs?.length) {
      return { id: course.labs[0].id, tool: course.labs[0].tool };
    }
    const next = progress.labs.find((l) => !l.completed && !l.locked);
    return next ?? progress.labs[0];
  }, [course, progress]);

  const continueHref = useMemo(() => {
    if (!course || !firstActionable) return "/";
    return `/?${buildLaunchSearch(course.id, firstActionable.id, firstActionable.tool)}`;
  }, [course, firstActionable]);

  const startHref = useMemo(() => {
    const first = course?.labs?.[0];
    if (!course || !first) return "/";
    return `/?${buildLaunchSearch(course.id, first.id, first.tool)}`;
  }, [course]);

  if (loading) {
    return (
      <PageShell title="Course" description="">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }

  if (!course) {
    return (
      <PageShell title="Course" description="">
        <p className="text-sm text-muted-foreground">Course not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/courses">Back to courses</Link>
        </Button>
      </PageShell>
    );
  }

  const percent = progress?.percent ?? 0;
  const allDone = progress?.labs?.every((l) => l.completed) ?? false;

  const main = (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/courses">
            <ArrowLeft className="h-4 w-4" />
            All courses
          </Link>
        </Button>
        <Badge variant="outline">{(course.plan ?? "free") === "pro" ? "Pro" : "Free"} course</Badge>
      </div>

      {user?.id && progress && !paywall ? (
        <div className="mb-8 rounded-xl border border-border bg-card/60 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Overall progress</p>
            <span className="text-sm tabular-nums text-muted-foreground">{percent}%</span>
          </div>
          <Progress value={percent} className="mt-2 h-2.5" />
        </div>
      ) : !paywall ? (
        <p className="mb-6 text-sm text-muted-foreground">Sign in to track progress across sessions.</p>
      ) : null}

      {!paywall ? (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            <Button asChild disabled={!user}>
              <Link to={user ? startHref : "/"}>{allDone ? "Review first lab" : "Start"}</Link>
            </Button>
            <Button asChild variant="secondary" disabled={!user || allDone}>
              <Link to={user && !allDone ? continueHref : "/"}>Continue</Link>
            </Button>
          </div>

          <h2 className="mb-3 text-sm font-semibold text-foreground">Labs</h2>
          <ol className="space-y-3">
            {course.labs?.map((lab, i) => {
              const p = progress?.labs?.find((x) => x.id === lab.id);
              const completed = p?.completed ?? false;
              const locked = progress ? (p?.locked ?? false) : i > 0;
              const sub = p ? `${p.completedCount}/${p.totalCount} checks` : "";

              return (
                <li
                  key={lab.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                      {completed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{lab.title ?? lab.tool}</p>
                      <p className="text-xs text-muted-foreground">
                        {lab.tool}
                        {sub ? ` · ${sub}` : ""}
                      </p>
                      {locked ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                          <Lock className="h-3 w-3" />
                          Complete the previous lab to unlock.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Button asChild size="sm" variant={completed ? "outline" : "default"} disabled={!user || locked}>
                    <Link to={user && !locked ? `/?${buildLaunchSearch(course.id, lab.id, lab.tool)}` : "/"}>
                      {completed ? "Again" : locked ? "Locked" : "Open"}
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </>
  );

  return (
    <PageShell title={course.title} description={course.description ?? ""}>
      <div className="relative min-h-[320px]">
        {paywall ? (
          <>
            <div className="pointer-events-none select-none opacity-[0.2] blur-[1px]">{main}</div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-background/85 p-6 text-center backdrop-blur-sm">
              <Lock className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold text-foreground">Pro course</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Upgrade to Pro to access this path and all premium labs.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" onClick={() => setUpgradeOpen(true)}>
                  Upgrade to Pro
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/pricing">Pricing</Link>
                </Button>
              </div>
            </div>
          </>
        ) : (
          main
        )}
      </div>

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
