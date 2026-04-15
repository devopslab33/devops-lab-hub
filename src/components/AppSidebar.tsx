import {
  Terminal,
  LayoutDashboard,
  FlaskConical,
  Crown,
  Settings,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Active Labs", url: "/active-labs", icon: FlaskConical },
  { title: "Pro Plan", url: "/pro-plan", icon: Crown },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
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
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground">
            DV
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Developer</p>
            <p className="text-xs text-muted-foreground truncate">dev@devops-labs.io</p>
          </div>
          <button className="text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
