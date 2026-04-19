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

export function isLabProgressConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} stepId
 * @param {{ courseId?: string | null, courseLabId?: string | null }} [meta]
 * @returns {Promise<{ ok: boolean, skipped?: boolean }>}
 */
export async function upsertLabStepPassed(userId, sessionId, stepId, meta = {}) {
  const supabase = getClient();
  if (!supabase) {
    return { ok: false, skipped: true };
  }

  const courseId = meta.courseId != null && String(meta.courseId).trim() ? String(meta.courseId).trim() : null;
  const courseLabId =
    meta.courseLabId != null && String(meta.courseLabId).trim() ? String(meta.courseLabId).trim() : null;

  const row = {
    user_id: String(userId),
    session_id: String(sessionId),
    step_id: String(stepId),
    status: "passed",
    completed_at: new Date().toISOString(),
    course_id: courseId,
    course_lab_id: courseLabId,
  };

  const { error } = await supabase.from("lab_progress").upsert(row, {
    onConflict: "user_id,session_id,step_id",
  });

  if (error) {
    console.error("[lab_progress] upsert:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<string[]>}
 */
export async function getCompletedStepIds(userId, sessionId) {
  const supabase = getClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("lab_progress")
    .select("step_id, completed_at")
    .eq("user_id", String(userId))
    .eq("session_id", String(sessionId))
    .eq("status", "passed")
    .order("completed_at", { ascending: true });

  if (error) {
    console.error("[lab_progress] select:", error.message);
    return [];
  }

  return (data ?? []).map((r) => r.step_id).filter(Boolean);
}

/**
 * All passed step_ids for a course lab (any session), deduped.
 * @param {string} userId
 * @param {string} courseId
 * @param {string} courseLabId
 * @returns {Promise<string[]>}
 */
export async function getCourseLabCompletedStepIds(userId, courseId, courseLabId) {
  const supabase = getClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("lab_progress")
    .select("step_id")
    .eq("user_id", String(userId))
    .eq("course_id", String(courseId))
    .eq("course_lab_id", String(courseLabId))
    .eq("status", "passed");

  if (error) {
    console.error("[lab_progress] course lab select:", error.message);
    return [];
  }

  const set = new Set((data ?? []).map((r) => r.step_id).filter(Boolean));
  return [...set];
}
