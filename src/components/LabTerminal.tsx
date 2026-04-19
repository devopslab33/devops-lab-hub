import { useCallback, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Copy, Eraser, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type LabTerminalProps = {
  wsUrl: string;
  containerName: string;
  className?: string;
  /** Shown above the terminal area to guide beginners. */
  leadIn?: string;
  /** Increment to programmatically focus the terminal (e.g. after clicking a step). */
  focusNonce?: number;
};

const TERM_THEME = {
  background: "#070a0e",
  foreground: "#e6edf3",
  cursor: "#7dd3fc",
  cursorAccent: "#020617",
  selectionBackground: "#264f78",
  black: "#484f58",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#b1bac4",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc",
};

export function LabTerminal({ wsUrl, containerName, className, leadIn, focusNonce = 0 }: LabTerminalProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [reconnectEpoch, setReconnectEpoch] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Shown above xterm until the user sends input or receives output. */
  const [showIdleHelper, setShowIdleHelper] = useState(true);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error("Fullscreen is not available in this browser.");
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const bumpReconnect = useCallback(() => {
    setReconnectEpoch((n) => n + 1);
  }, []);

  const clearTerminal = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const copySelection = useCallback(async () => {
    const term = terminalRef.current;
    if (!term) return;
    const text = term.getSelection();
    if (!text.trim()) {
      toast.message("Select text in the terminal first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      term.clearSelection();
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let teardown: (() => void) | undefined;
    let finalized = false;

    setShowIdleHelper(true);

    void (async () => {
      await document.fonts?.ready?.catch(() => undefined);
      if (disposed || !hostRef.current) return;

      setStatus("connecting");

      const terminal = new Terminal({
        cursorBlink: true,
        convertEol: false,
        scrollback: 12_000,
        fontFamily: '"JetBrains Mono", "Cascadia Mono", "Consolas", monospace',
        fontSize: 15,
        lineHeight: 1.25,
        letterSpacing: 0,
        drawBoldTextInBrightColors: true,
        fontWeight: "400",
        fontWeightBold: "600",
        theme: TERM_THEME,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      const fitNow = () => {
        try {
          fitAddon.fit();
        } catch {
          /* ignore */
        }
      };

      terminal.open(hostRef.current!);

      requestAnimationFrame(() => {
        fitNow();
        requestAnimationFrame(fitNow);
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      const markTerminalUsed = () => {
        if (disposed) return;
        setShowIdleHelper((v) => (v ? false : v));
      };

      if (disposed) {
        terminal.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
        return;
      }

      const ro = new ResizeObserver(() => {
        if (disposed || !terminalRef.current) return;
        try {
          fitAddon.fit();
          const socket = socketRef.current;
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "resize",
                cols: terminal.cols,
                rows: terminal.rows,
              }),
            );
          }
        } catch {
          /* ignore */
        }
      });
      ro.observe(host);

      const socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      const sendResize = () => {
        fitNow();
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "resize",
              cols: terminal.cols,
              rows: terminal.rows,
            }),
          );
        }
      };

      const onOpen = () => {
        if (disposed) return;
        setStatus("connected");
        sendResize();
        terminal.focus();
      };

      const onMessage = (event: MessageEvent) => {
        const { data } = event;
        if (data instanceof ArrayBuffer) {
          markTerminalUsed();
          terminal.write(new Uint8Array(data));
          return;
        }
        if (typeof Blob !== "undefined" && data instanceof Blob) {
          void data.arrayBuffer().then((ab) => {
            if (!disposed && terminalRef.current) {
              markTerminalUsed();
              terminal.write(new Uint8Array(ab));
            }
          });
          return;
        }
        if (typeof data !== "string") return;
        let message: { type: string; data?: string; message?: string; variant?: string };
        try {
          message = JSON.parse(data) as { type: string; data?: string; message?: string; variant?: string };
        } catch {
          return;
        }
        if (message.type === "ready") {
          return;
        }
        if (message.type === "toast" && message.message) {
          if (message.variant === "success") {
            toast.success(message.message);
          } else {
            toast.message(message.message);
          }
          return;
        }
        if (message.type === "error" && message.data) {
          toast.error(message.data);
        }
      };

      const onClose = () => {
        if (disposed) return;
        setStatus("disconnected");
      };

      const onSocketError = () => {
        if (disposed) return;
        setStatus("error");
        toast.error("Unable to connect to the lab terminal.");
      };

      socket.addEventListener("open", onOpen);
      socket.addEventListener("message", onMessage);
      socket.addEventListener("close", onClose);
      socket.addEventListener("error", onSocketError);

      const disposable = terminal.onData((d) => {
        markTerminalUsed();
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "input", data: d }));
        }
      });

      const onWindowResize = () => {
        if (socket.readyState === WebSocket.OPEN) {
          sendResize();
        } else {
          fitNow();
        }
      };

      window.addEventListener("resize", onWindowResize);

      const onVisibility = () => {
        if (document.visibilityState !== "visible" || disposed) return;
        const s = socketRef.current;
        if (s && (s.readyState === WebSocket.CLOSED || s.readyState === WebSocket.CLOSING)) {
          setReconnectEpoch((n) => n + 1);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      teardown = () => {
        if (finalized) return;
        finalized = true;
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", onWindowResize);
        ro.disconnect();
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("message", onMessage);
        socket.removeEventListener("close", onClose);
        socket.removeEventListener("error", onSocketError);
        disposable.dispose();
        socket.close();
        terminal.dispose();
        socketRef.current = null;
        terminalRef.current = null;
        fitAddonRef.current = null;
      };

      if (disposed) {
        teardown();
      }
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, [containerName, wsUrl, reconnectEpoch]);

  useEffect(() => {
    if (!focusNonce) return;
    const id = requestAnimationFrame(() => {
      terminalRef.current?.focus();
      requestAnimationFrame(() => terminalRef.current?.focus());
    });
    return () => cancelAnimationFrame(id);
  }, [focusNonce]);

  const statusLabel =
    status === "connected"
      ? "Live"
      : status === "connecting"
        ? "Connecting"
        : status === "disconnected"
          ? "Disconnected"
          : "Error";

  const statusDot =
    status === "connected"
      ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
      : status === "connecting"
        ? "bg-amber-400 animate-pulse"
        : "bg-red-500";

  return (
    <div
      ref={shellRef}
      className={cn(
        "lab-terminal-shell flex flex-col overflow-hidden rounded-xl border border-cyan-400/20 bg-[#05070a] shadow-inner",
        "shadow-[0_0_40px_-10px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-cyan-400/15",
        isFullscreen && "rounded-none border-0 ring-0",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#0a0d12]/95 px-2 py-1.5 backdrop-blur-sm sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDot)} aria-hidden />
          <span className="truncate font-mono text-[11px] text-muted-foreground sm:text-xs tracking-tight">
            <span className="font-medium text-foreground/95">{containerName}</span>
            <span className="mx-1.5 text-border">|</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                status === "connected" && "bg-emerald-500/15 text-emerald-400",
                status === "connecting" && "bg-amber-500/15 text-amber-300",
                (status === "disconnected" || status === "error") && "bg-red-500/10 text-red-300",
              )}
            >
              {statusLabel}
            </span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={clearTerminal} aria-label="Clear terminal view">
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Clear view (local only)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => void copySelection()} aria-label="Copy selection">
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Copy selection</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={bumpReconnect} aria-label="Reconnect">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Reconnect</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => void toggleFullscreen()}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {status === "connected" && showIdleHelper ? (
        <div className="shrink-0 space-y-1 border-b border-white/[0.06] bg-[#080b10]/90 px-3 py-2 text-[12px] leading-snug text-muted-foreground">
          <p>👉 Run the command from the left panel</p>
          <p>👉 Waiting for your command…</p>
        </div>
      ) : leadIn ? (
        <p className="shrink-0 border-b border-white/[0.06] bg-[#080b10]/90 px-3 py-2 text-[13px] leading-snug text-muted-foreground">
          👉 {leadIn}
        </p>
      ) : null}

      <div
        ref={hostRef}
        className={cn(
          "lab-terminal-host min-h-0 w-full min-w-0 flex-1 py-1 pl-2 pr-1 sm:py-1.5 sm:pl-3 sm:pr-2",
          isFullscreen ? "h-full max-h-none" : "min-h-[min(280px,45dvh)] h-[min(52dvh,600px)] xl:h-full xl:min-h-[380px]",
        )}
      />
    </div>
  );
}
