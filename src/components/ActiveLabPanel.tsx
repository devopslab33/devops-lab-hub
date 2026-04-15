import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Timer, Plus, Square, Terminal, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ActiveLabPanelProps {
  toolName: string;
  toolIcon: LucideIcon;
  onDestroy: () => void;
}

export function ActiveLabPanel({ toolName, toolIcon: Icon, onDestroy }: ActiveLabPanelProps) {
  const [seconds, setSeconds] = useState(59 * 60 + 45);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="rounded-xl border border-primary/20 bg-card glow-primary overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Icon className="w-5 h-5" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-success border-2 border-card animate-pulse" />
          </div>
          <div>
            <p className="text-foreground font-semibold">{toolName} Lab</p>
            <p className="text-xs text-muted-foreground">Running &middot; Lab Instance</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 font-mono text-sm">
            <Timer className="w-4 h-4 text-primary" />
            <span className={`font-semibold ${seconds < 300 ? "text-destructive" : "text-foreground"}`}>
              {mm}:{ss}
            </span>
            <span className="text-muted-foreground text-xs">remaining</span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 border-border text-secondary-foreground hover:bg-secondary">
            <Plus className="w-3.5 h-3.5" />
            Extend Time
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 glow-destructive"
            onClick={onDestroy}
          >
            <Square className="w-3.5 h-3.5" />
            Destroy Lab
          </Button>
        </div>
      </div>

      {/* Terminal placeholder */}
      <div className="p-5">
        <div className="rounded-lg bg-background border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/50">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-mono">terminal — {toolName.toLowerCase()}-lab-01</span>
            <button className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 font-mono text-sm leading-relaxed min-h-[140px]">
            <p className="text-success">$ Connecting to {toolName.toLowerCase()}-lab-01.devops-labs.io...</p>
            <p className="text-muted-foreground mt-1">Establishing secure tunnel...</p>
            <p className="text-success mt-1">✓ Connected successfully</p>
            <p className="text-muted-foreground mt-1">
              <span className="text-terminal">developer@lab-01:~$</span>{" "}
              <span className="animate-pulse">▌</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
