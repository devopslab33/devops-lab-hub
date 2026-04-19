import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Terminal,
  GitBranch,
  Box,
  Settings,
  Network,
  GitMerge,
  Layers,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthDialog } from "@/components/AuthDialog";
import { MobileNav } from "@/components/MobileNav";
import { ToolCard } from "@/components/ToolCard";
import { ActiveLabPanel } from "@/components/ActiveLabPanel";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { buildTerminalWebSocketUrl, fetchActiveLabs, startLabSession, stopLabSession, type ActiveLabResponse } from "@/lib/labApi";

const devopsCategories = ["All", "Foundations", "Containers", "Orchestration", "CI/CD", "IaC", "Observability"] as const;

type Tool = {
  id: string;
  tool: "linux" | "git" | "docker" | "terraform" | "nginx";
  name: string;
  description: string;
  category: "Foundations" | "Containers" | "Orchestration" | "CI/CD" | "IaC" | "Observability";
  plan: "Free" | "Pro";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  timeLimit: string;
  ramLimit: string;
  icon: "Terminal" | "GitBranch" | "Box" | "Settings" | "Network" | "GitMerge" | "Layers" | "Activity";
};

const devopsTools: Tool[] = [
  { id: "linux-lab", tool: "linux", name: "Linux Lab", description: "Ubuntu-based shell environment for Linux practice, file operations, and command-line fundamentals.", category: "Foundations", plan: "Free", difficulty: "Beginner", timeLimit: "30 Mins", ramLimit: "128MB", icon: "Terminal" },
  { id: "git-lab", tool: "git", name: "Git Lab", description: "Preconfigured Git environment with curl and vim for repository workflows and version control drills.", category: "Foundations", plan: "Free", difficulty: "Beginner", timeLimit: "30 Mins", ramLimit: "256MB", icon: "GitBranch" },
  { id: "docker-lab", tool: "docker", name: "Docker Lab", description: "DevOps base environment with Docker CLI, Git, curl, and vim for container workflow practice.", category: "Containers", plan: "Pro", difficulty: "Intermediate", timeLimit: "45 Mins", ramLimit: "512MB", icon: "Box" },
  { id: "terraform-lab", tool: "terraform", name: "Terraform Lab", description: "Ubuntu-based Terraform environment with CLI tooling for provisioning and infrastructure-as-code practice.", category: "IaC", plan: "Pro", difficulty: "Intermediate", timeLimit: "1.5 Hours", ramLimit: "512MB", icon: "Layers" },
  { id: "nginx-lab", tool: "nginx", name: "Nginx Lab", description: "Alpine nginx with port 80 published to a temporary /lab URL for browser access plus a shell for config drills.", category: "Containers", plan: "Free", difficulty: "Beginner", timeLimit: "30 Mins", ramLimit: "128MB", icon: "Network" },
];

type ActiveLabTool = Tool & {
  iconComponent: LucideIcon;
  sessionId: string;
  containerId: string;
  containerName: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  terminalUrl: string;
  appUrl: string | null;
  publishedContainerPorts?: number[];
  courseId?: string;
  courseLabId?: string;
};

const iconMap: Record<Tool["icon"], LucideIcon> = {
  Terminal,
  GitBranch,
  Box,
  Settings,
  Network,
  GitMerge,
  Layers,
  Activity,
};

function iconColorByCategory(category: Tool["category"]) {
  switch (category) {
    case "Foundations":
      return "text-[hsl(205,85%,60%)]";
    case "Containers":
      return "text-[hsl(215,80%,62%)]";
    case "Orchestration":
      return "text-[hsl(262,82%,68%)]";
    case "CI/CD":
      return "text-[hsl(20,88%,58%)]";
    case "IaC":
      return "text-[hsl(0,72%,62%)]";
    case "Observability":
      return "text-[hsl(145,74%,58%)]";
    default:
      return "text-primary";
  }
}

export default function Index() {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeLab, setActiveLab] = useState<ActiveLabTool | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingTool, setPendingTool] = useState<Tool | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveLabResponse[]>([]);

  const storageKey = useMemo(() => (user?.id ? `active-lab-session:${user.id}` : null), [user?.id]);

  const hydrateActiveLab = useCallback(
    (session: ActiveLabResponse) => {
      const matchingTool =
        devopsTools.find((tool) => tool.tool === session.tool) ?? devopsTools.find((tool) => tool.name === session.toolName);
      if (!matchingTool) return;

      setActiveLab({
        ...matchingTool,
        iconComponent: iconMap[matchingTool.icon],
        sessionId: session.id,
        containerId: session.containerId,
        containerName: session.containerName,
        status: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        terminalUrl: buildTerminalWebSocketUrl(session.wsPath),
        appUrl: session.url ?? null,
        publishedContainerPorts: session.publishedContainerPorts ?? [],
      });
    },
    [],
  );

  const recordAndStartLab = useCallback(
    async (tool: Tool, course?: { courseId: string; courseLabId: string }) => {
      const labSession = await startLabSession({
        userId: user?.id,
        tool: tool.tool,
      });

      setActiveLab({
        ...tool,
        iconComponent: iconMap[tool.icon],
        sessionId: labSession.sessionId,
        containerId: labSession.containerId,
        containerName: labSession.containerName,
        status: labSession.status,
        createdAt: labSession.createdAt,
        expiresAt: labSession.expiresAt,
        terminalUrl: buildTerminalWebSocketUrl(labSession.wsPath),
        appUrl: labSession.url ?? null,
        publishedContainerPorts: labSession.publishedContainerPorts ?? [],
        courseId: course?.courseId,
        courseLabId: course?.courseLabId,
      });
      setSearchParams({ sessionId: labSession.sessionId });
      if (storageKey) {
        window.localStorage.setItem(storageKey, labSession.sessionId);
      }
    },
    [setSearchParams, storageKey, user?.id],
  );

  const handleLaunchRequest = useCallback(
    (tool: Tool) => {
      if (!user) {
        setPendingTool(tool);
        setAuthOpen(true);
        return;
      }

      void recordAndStartLab(tool).catch((error) => {
        toast.error("Could not start lab", {
          description: error instanceof Error ? error.message : "Unable to launch the lab container.",
        });
      });
    },
    [user, recordAndStartLab],
  );

  const handleAuthenticated = useCallback(() => {
    setAuthOpen(false);
    if (pendingTool) {
      const tool = pendingTool;
      setPendingTool(null);
      void recordAndStartLab(tool).catch((error) => {
        toast.error("Could not start lab", {
          description: error instanceof Error ? error.message : "Unable to launch the lab container.",
        });
      });
    }
  }, [pendingTool, recordAndStartLab]);

  const handleDestroyLab = useCallback(async () => {
    if (!activeLab) return;
    await stopLabSession(activeLab.sessionId);
    setActiveLab(null);
    setSearchParams({});
    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }
    if (user?.id) {
      const nextSessions = await fetchActiveLabs(user.id);
      setActiveSessions(nextSessions);
    }
  }, [activeLab, setSearchParams, storageKey, user?.id]);

  const handleResetLab = useCallback(async () => {
    if (!activeLab || !user?.id) return;
    const toolDef = devopsTools.find((t) => t.tool === activeLab.tool);
    if (!toolDef) return;
    try {
      await stopLabSession(activeLab.sessionId);
      if (storageKey) {
        window.localStorage.removeItem(storageKey);
      }
      setSearchParams({});
      const labSession = await startLabSession({ userId: user.id, tool: toolDef.tool });
      setActiveLab({
        ...toolDef,
        iconComponent: iconMap[toolDef.icon],
        sessionId: labSession.sessionId,
        containerId: labSession.containerId,
        containerName: labSession.containerName,
        status: labSession.status,
        createdAt: labSession.createdAt,
        expiresAt: labSession.expiresAt,
        terminalUrl: buildTerminalWebSocketUrl(labSession.wsPath),
        appUrl: labSession.url ?? null,
        publishedContainerPorts: labSession.publishedContainerPorts ?? [],
        courseId: activeLab.courseId,
        courseLabId: activeLab.courseLabId,
      });
      setSearchParams({ sessionId: labSession.sessionId });
      if (storageKey) {
        window.localStorage.setItem(storageKey, labSession.sessionId);
      }
      const nextSessions = await fetchActiveLabs(user.id);
      setActiveSessions(nextSessions);
    } catch (error) {
      toast.error("Could not reset lab", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    }
  }, [activeLab, setSearchParams, storageKey, user?.id]);

  const nextLabAfter = useMemo(() => {
    if (!activeLab) return null;
    const idx = devopsTools.findIndex((t) => t.tool === activeLab.tool);
    return devopsTools[idx + 1] ?? null;
  }, [activeLab]);

  const handleTryNextLab = useCallback(async () => {
    if (!activeLab || !user?.id || !nextLabAfter) return;
    try {
      await stopLabSession(activeLab.sessionId);
      if (storageKey) {
        window.localStorage.removeItem(storageKey);
      }
      setSearchParams({});
      const labSession = await startLabSession({ userId: user.id, tool: nextLabAfter.tool });
      setActiveLab({
        ...nextLabAfter,
        iconComponent: iconMap[nextLabAfter.icon],
        sessionId: labSession.sessionId,
        containerId: labSession.containerId,
        containerName: labSession.containerName,
        status: labSession.status,
        createdAt: labSession.createdAt,
        expiresAt: labSession.expiresAt,
        terminalUrl: buildTerminalWebSocketUrl(labSession.wsPath),
        appUrl: labSession.url ?? null,
        publishedContainerPorts: labSession.publishedContainerPorts ?? [],
      });
      setSearchParams({ sessionId: labSession.sessionId });
      if (storageKey) {
        window.localStorage.setItem(storageKey, labSession.sessionId);
      }
      const nextSessions = await fetchActiveLabs(user.id);
      setActiveSessions(nextSessions);
      toast.success(`Started ${nextLabAfter.name}`);
    } catch (error) {
      toast.error("Could not start the next lab", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    }
  }, [activeLab, nextLabAfter, setSearchParams, storageKey, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadActiveLabs = async () => {
      try {
        const sessions = await fetchActiveLabs(user.id);
        if (cancelled) return;
        setActiveSessions(sessions);

        if (searchParams.get("launchCourse") === "1") {
          return;
        }

        const querySessionId = searchParams.get("sessionId");
        const storedSessionId = storageKey ? window.localStorage.getItem(storageKey) : null;
        const targetSessionId = querySessionId || storedSessionId;
        if (!targetSessionId) return;

        const matchingSession = sessions.find((session) => session.id === targetSessionId);
        if (!matchingSession) {
          if (storageKey) {
            window.localStorage.removeItem(storageKey);
          }
          return;
        }

        hydrateActiveLab(matchingSession);
        if (storageKey) {
          window.localStorage.setItem(storageKey, matchingSession.id);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("Could not load active labs", {
            description: error instanceof Error ? error.message : "Unable to restore running lab sessions.",
          });
        }
      }
    };

    void loadActiveLabs();

    return () => {
      cancelled = true;
    };
  }, [hydrateActiveLab, searchParams, storageKey, user?.id]);

  useEffect(() => {
    if (!user?.id || loading) return;
    if (activeLab) return;

    if (searchParams.get("launchCourse") !== "1") return;
    const courseId = searchParams.get("courseId")?.trim();
    const courseLabId = searchParams.get("courseLabId")?.trim();
    const tool = searchParams.get("tool")?.trim() as Tool["tool"] | undefined;
    if (!courseId || !courseLabId || !tool) return;

    const sig = `${courseId}|${courseLabId}|${tool}`;
    const guardKey = `lab-course-launch:${sig}`;
    const prev = sessionStorage.getItem(guardKey);
    const now = Date.now();
    if (prev && now - Number(prev) < 4000) return;
    sessionStorage.setItem(guardKey, String(now));

    const toolObj = devopsTools.find((t) => t.tool === tool);
    if (!toolObj) {
      sessionStorage.removeItem(guardKey);
      return;
    }

    void recordAndStartLab(toolObj, { courseId, courseLabId }).catch((error) => {
      sessionStorage.removeItem(guardKey);
      toast.error("Could not start lab", {
        description: error instanceof Error ? error.message : "Unable to launch the lab container.",
      });
    });
  }, [user?.id, loading, activeLab, searchParams, recordAndStartLab]);

  const displayName = useMemo(() => {
    if (!user?.email) return "Developer";
    const local = user.email.split("@")[0] ?? "Developer";
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : "Developer";
  }, [user?.email]);

  const filtered = devopsTools.filter((tool) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.category.toLowerCase().includes(query);
    const matchesCategory = activeCategory === "All" || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar onOpenAuth={() => setAuthOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav onOpenAuth={() => setAuthOpen(true)} />
        <main
          className={cn(
            "mx-auto w-full flex-1 p-4 sm:p-6 lg:p-8",
            activeLab ? "max-w-[min(120rem,calc(100%-1rem))]" : "max-w-6xl",
          )}
        >
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Welcome back,{" "}
              {loading ? (
                <Skeleton className="inline-flex h-8 w-36 align-middle rounded-md" />
              ) : (
                `${displayName}!`
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeLab
                ? "Your lab is running. Use the terminal below to continue working in a focused environment."
                : "Ready to practice? Launch a lab environment below."}
            </p>
          </div>

          {activeLab && (
            <div className="space-y-6">
              <ActiveLabPanel
                labTitle={activeLab.name}
                toolKey={activeLab.tool}
                toolIcon={activeLab.iconComponent}
                containerName={activeLab.containerName}
                terminalUrl={activeLab.terminalUrl}
                appUrl={activeLab.appUrl}
                sessionId={activeLab.sessionId}
                userId={user?.id ?? "guest"}
                courseId={activeLab.courseId}
                courseLabId={activeLab.courseLabId}
                publishedContainerPorts={activeLab.publishedContainerPorts}
                expiresAt={activeLab.expiresAt}
                onDestroy={handleDestroyLab}
                onResetLab={handleResetLab}
                hasNextLab={Boolean(nextLabAfter && user?.id)}
                nextLabName={nextLabAfter?.name}
                onTryNextLab={user?.id ? handleTryNextLab : undefined}
              />

              <div className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Current lab details</p>
                    <p className="text-xs text-muted-foreground">
                      Session stays persistent, and you can reconnect any time from the Active Labs page.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md border border-border px-2.5 py-1">{activeLab.name}</span>
                    <span className="rounded-md border border-border px-2.5 py-1">{activeLab.timeLimit}</span>
                    <span className="rounded-md border border-border px-2.5 py-1">{activeLab.ramLimit}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!activeLab && (
            <>
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tools..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {devopsCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        activeCategory === category
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-secondary text-muted-foreground hover:text-foreground border border-transparent"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    name={tool.name}
                    description={tool.description}
                    icon={iconMap[tool.icon]}
                    iconColor={iconColorByCategory(tool.category)}
                    plan={tool.plan}
                    difficulty={tool.difficulty}
                    timeLimit={tool.timeLimit}
                    onLaunch={() => handleLaunchRequest(tool)}
                  />
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <p>No tools match your search.</p>
                </div>
              )}

              {activeSessions.length > 0 && (
                <div className="mt-8 rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium text-foreground">Running sessions</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Refresh-safe sessions are available to reconnect from the Active Labs page.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <AuthDialog
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) setPendingTool(null);
        }}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}
