import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserSubscription, postSimulatedProUpgrade, type UserSubscription } from "@/lib/labApi";

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription>({
    plan: "free",
    status: "active",
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSubscription({ plan: "free", status: "active", expiresAt: null });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sub = await fetchUserSubscription(user.id);
      setSubscription(sub);
    } catch {
      setSubscription({ plan: "free", status: "active", expiresAt: null });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upgradeToProSimulated = useCallback(async () => {
    if (!user?.id) return;
    const sub = await postSimulatedProUpgrade(user.id);
    setSubscription(sub);
  }, [user?.id]);

  const isPro = subscription.plan === "pro" && subscription.status === "active";

  return { subscription, loading, isPro, refresh, upgradeToProSimulated };
}
