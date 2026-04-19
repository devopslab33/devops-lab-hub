import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

const REDIRECT_MS = 1500;

export default function LabLoading() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";
  const port = searchParams.get("port")?.trim() ?? "";
  const missing = !sessionId || !port;

  useEffect(() => {
    if (missing) return;
    const t = window.setTimeout(() => {
      const path = `/lab/${encodeURIComponent(sessionId)}/${encodeURIComponent(port)}`;
      window.location.replace(path);
    }, REDIRECT_MS);
    return () => window.clearTimeout(t);
  }, [sessionId, port, missing]);

  if (missing) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
        <p className="mb-4 text-center text-sm text-muted-foreground">Missing session or port.</p>
        <Link to="/" className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/90">
          Return home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-background to-muted/30 px-6 text-center">
      <Loader2 className="h-12 w-12 shrink-0 animate-spin text-primary" aria-hidden />
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Opening your app…</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If it doesn&apos;t load, ensure your container is running.
        </p>
      </div>
    </div>
  );
}
