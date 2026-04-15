import { useState } from "react";
import { Search, Box, Ship, Workflow, Cog, MonitorSpeaker } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ToolCard } from "@/components/ToolCard";
import { ActiveLabPanel } from "@/components/ActiveLabPanel";
import { Input } from "@/components/ui/input";
import type { LucideIcon } from "lucide-react";

interface Tool {
  name: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  tier: "Free" | "Pro";
  category: string;
}

const tools: Tool[] = [
  {
    name: "Docker",
    description: "Build, ship, and run containers. Learn image management and orchestration basics.",
    icon: Box,
    iconColor: "text-[hsl(205,85%,55%)]",
    tier: "Free",
    category: "Containers",
  },
  {
    name: "Kubernetes",
    description: "Orchestrate containers at scale. Deploy pods, services, and ingress controllers.",
    icon: Ship,
    iconColor: "text-[hsl(215,80%,60%)]",
    tier: "Pro",
    category: "Containers",
  },
  {
    name: "Jenkins",
    description: "Automate CI/CD pipelines. Configure jobs, agents, and deployment workflows.",
    icon: Workflow,
    iconColor: "text-[hsl(15,80%,55%)]",
    tier: "Free",
    category: "CI/CD",
  },
  {
    name: "Ansible",
    description: "Automate infrastructure provisioning with playbooks and roles for any cloud.",
    icon: Cog,
    iconColor: "text-[hsl(0,70%,55%)]",
    tier: "Pro",
    category: "Cloud",
  },
  {
    name: "Ubuntu",
    description: "Practice Linux administration, shell scripting, and system configuration.",
    icon: MonitorSpeaker,
    iconColor: "text-[hsl(25,90%,55%)]",
    tier: "Free",
    category: "Linux",
  },
];

const categories = ["All", "Containers", "CI/CD", "Cloud", "Linux"];

export default function Index() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeLab, setActiveLab] = useState<Tool | null>(null);

  const filtered = tools.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === "All" || t.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Welcome back, Developer!
            </h1>
            <p className="text-muted-foreground mt-1">Ready to practice? Launch a lab environment below.</p>
          </div>

          {/* Active Lab */}
          {activeLab && (
            <div className="mb-8">
              <ActiveLabPanel
                toolName={activeLab.name}
                toolIcon={activeLab.icon}
                onDestroy={() => setActiveLab(null)}
              />
            </div>
          )}

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-secondary text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tool Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tool) => (
              <ToolCard
                key={tool.name}
                {...tool}
                onLaunch={() => setActiveLab(tool)}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p>No tools match your search.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
