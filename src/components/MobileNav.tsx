import { useState } from "react";
import {
  Terminal,
  LayoutDashboard,
  FlaskConical,
  Crown,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Active Labs", url: "/active-labs", icon: FlaskConical },
  { title: "Pro Plan", url: "/pro-plan", icon: Crown },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[hsl(var(--sidebar-background))]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-foreground font-semibold">DevOps Labs</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-foreground">
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
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground">
              DV
            </div>
            <span className="text-xs text-muted-foreground">dev@devops-labs.io</span>
            <LogOut className="w-4 h-4 ml-auto text-muted-foreground" />
          </div>
        </nav>
      )}
    </div>
  );
}
