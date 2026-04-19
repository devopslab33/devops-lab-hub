import { useState } from "react";
import {
  Terminal,
  LayoutDashboard,
  FlaskConical,
  Crown,
  Settings,
  LogOut,
  LogIn,
  Menu,
  X,
  BookOpen,
  CircleDollarSign,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { initialsFromEmail } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Courses", url: "/courses", icon: BookOpen },
  { title: "Pricing", url: "/pricing", icon: CircleDollarSign },
  { title: "Active Labs", url: "/active-labs", icon: FlaskConical },
  { title: "Pro Plan", url: "/pro-plan", icon: Crown },
  { title: "Settings", url: "/settings", icon: Settings },
];

type MobileNavProps = {
  onOpenAuth: () => void;
};

export function MobileNav({ onOpenAuth }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { user, loading, signOut } = useAuth();
  const email = user?.email ?? null;
  const initials = initialsFromEmail(email);

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[hsl(var(--sidebar-background))]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-foreground font-semibold">DevOps Labs</span>
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="text-foreground">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <nav className="px-4 py-3 border-b border-border bg-[hsl(var(--sidebar-background))] flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              activeClassName="bg-secondary text-primary font-medium"
              onClick={() => setOpen(false)}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-2 border-t border-border pt-3">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground shrink-0">
              {loading ? "..." : initials}
            </div>
            <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
              {loading ? "Loading..." : email ?? "Not signed in"}
            </span>
            {user ? (
              <button
                type="button"
                title="Log out"
                aria-label="Log out"
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                title="Sign in"
                aria-label="Sign in"
                className="text-muted-foreground hover:text-primary shrink-0"
                onClick={() => {
                  setOpen(false);
                  onOpenAuth();
                }}
              >
                <LogIn className="w-4 h-4" />
              </button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
