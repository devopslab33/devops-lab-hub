import {
  Terminal,
  LayoutDashboard,
  FlaskConical,
  Crown,
  Settings,
  LogOut,
  LogIn,
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

type AppSidebarProps = {
  onOpenAuth: () => void;
};

export function AppSidebar({ onOpenAuth }: AppSidebarProps) {
  const { user, loading, signOut } = useAuth();
  const email = user?.email ?? null;
  const initials = initialsFromEmail(email);

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen border-r border-border bg-[hsl(var(--sidebar-background))] p-4">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
          <Terminal className="w-4 h-4" />
        </div>
        <span className="text-foreground font-semibold text-lg tracking-tight">
          DevOps Labs
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-foreground transition-colors"
            activeClassName="bg-[hsl(var(--sidebar-accent))] text-primary font-medium"
          >
            <item.icon className="w-4 h-4" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground shrink-0">
            {loading ? "..." : initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {loading ? "Loading..." : user ? "Account" : "Guest"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{loading ? " " : email ?? "Not signed in"}</p>
          </div>
          {user ? (
            <button
              type="button"
              title="Log out"
              aria-label="Log out"
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              onClick={() => void signOut()}
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              title="Sign in"
              aria-label="Sign in"
              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
              onClick={onOpenAuth}
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
