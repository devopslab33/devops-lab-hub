import { createClient } from "@supabase/supabase-js";

let client = null;

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * @param {string} userId
 * @returns {Promise<{ plan: string, status: string, expiresAt: string | null }>}
 */
export async function getSubscriptionForUser(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid || !isConfigured()) {
    return { plan: "free", status: "active", expiresAt: null };
  }

  const supabase = getClient();
  if (!supabase) {
    return { plan: "free", status: "active", expiresAt: null };
  }

  const { data, error } = await supabase.from("subscriptions").select("plan, status, expires_at").eq("user_id", uid).maybeSingle();

  if (error) {
    console.error("[subscriptions] select:", error.message);
    return { plan: "free", status: "active", expiresAt: null };
  }

  if (!data) {
    return { plan: "free", status: "active", expiresAt: null };
  }

  let plan = String(data.plan ?? "free");
  let status = String(data.status ?? "active");
  const expiresAt = data.expires_at != null ? String(data.expires_at) : null;

  if (status === "active" && plan === "pro" && expiresAt) {
    const t = new Date(expiresAt).getTime();
    if (Number.isFinite(t) && t < Date.now()) {
      plan = "free";
      status = "inactive";
    }
  }

  return { plan, status, expiresAt };
}

/**
 * Simulated upgrade — sets Pro without payment.
 * @param {string} userId
 */
export async function setUserPlanPro(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid || !isConfigured()) {
    return { ok: false, error: "not_configured" };
  }

  const supabase = getClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  const row = {
    user_id: uid,
    plan: "pro",
    status: "active",
    expires_at: expires.toISOString(),
  };

  const { error } = await supabase.from("subscriptions").upsert(row, { onConflict: "user_id" });

  if (error) {
    console.error("[subscriptions] upsert:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
