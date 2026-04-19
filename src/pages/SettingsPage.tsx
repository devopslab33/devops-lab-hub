import { Bell, Lock, UserCog } from "lucide-react";
import { PageShell } from "@/components/PageShell";

const settingsCards = [
  {
    title: "Profile preferences",
    description: "Review account-facing details and keep your workspace identity consistent.",
    icon: UserCog,
  },
  {
    title: "Security controls",
    description: "Manage authentication expectations, session hygiene, and access posture.",
    icon: Lock,
  },
  {
    title: "Notifications",
    description: "Control how lab updates and account events should reach the user.",
    icon: Bell,
  },
];

export default function SettingsPage() {
  return (
    <PageShell
      title="Settings"
      description="Configure account preferences, security defaults, and operational notifications."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingsCards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-border bg-card p-6">
            <card.icon className="mb-3 h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">{card.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
