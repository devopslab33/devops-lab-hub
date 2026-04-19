import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthDialog } from "@/components/AuthDialog";
import { MobileNav } from "@/components/MobileNav";

type PageShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar onOpenAuth={() => setAuthOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav onOpenAuth={() => setAuthOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
          {children}
        </main>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthenticated={() => setAuthOpen(false)} />
    </div>
  );
}
