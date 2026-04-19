import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
};

export function AuthDialog({ open, onOpenChange, onAuthenticated }: AuthDialogProps) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState<"login" | "signup">("login");

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFormError(null);
    setSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const finishIfSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      onAuthenticated();
      handleOpenChange(false);
      return true;
    }

    return false;
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    await finishIfSession();
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const { error } = await signUp(email.trim(), password);
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    const hasSession = await finishIfSession();
    if (!hasSession) {
      toast.message("Check your email", {
        description: "Confirm your account if required, then sign in to launch labs.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to DevOps Labs</DialogTitle>
          <DialogDescription>
            Launching lab environments requires an account. Sign in or create one with email and password.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as "login" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="auth-email-login">Email</Label>
                <Input
                  id="auth-email-login"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password-login">Password</Label>
                <Input
                  id="auth-password-login"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in..." : "Log in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="auth-email-signup">Email</Label>
                <Input
                  id="auth-email-signup"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password-signup">Password</Label>
                <Input
                  id="auth-password-signup"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
