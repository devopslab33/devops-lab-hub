import { useCallback, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CommandBlockProps = {
  command: string;
  className?: string;
};

export function CommandBlock({ command, className }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }, [command]);

  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted/30", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Command</span>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => void onCopy()}>
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-36 select-all overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[13px] leading-relaxed tracking-tight text-foreground">
        {command}
      </pre>
    </div>
  );
}
