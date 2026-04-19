import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getCourseLabCompletedStepIds } from "./labProgress.js";

const __dir = dirname(fileURLToPath(import.meta.url));

/** @type {unknown[]} */
let coursesCache = [];
/** @type {Record<string, unknown>} */
let labGuideCache = {};

try {
  coursesCache = JSON.parse(readFileSync(join(__dir, "..", "src", "data", "courses.json"), "utf-8"));
} catch {
  coursesCache = [];
}

try {
  labGuideCache = JSON.parse(readFileSync(join(__dir, "..", "src", "data", "lab-guide.json"), "utf-8"));
} catch {
  labGuideCache = {};
}

function normalizeGuideSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((entry, i) => {
    if (typeof entry === "string") {
      return { id: `step-${i + 1}`, validation: null };
    }
    const id = typeof entry.id === "string" && entry.id ? entry.id : `step-${i + 1}`;
    return {
      id,
      validation: entry.validation && typeof entry.validation === "object" ? entry.validation : null,
    };
  });
}

/** @param {string} tool */
export function getValidatedStepIdsForTool(tool) {
  const guide = labGuideCache[tool];
  const steps = normalizeGuideSteps(guide?.steps ?? []);
  return steps.filter((s) => s.validation).map((s) => s.id);
}

export function listCourses() {
  return Array.isArray(coursesCache) ? coursesCache : [];
}

export function getCourseById(courseId) {
  const id = String(courseId ?? "");
  return listCourses().find((c) => c && typeof c === "object" && c.id === id) ?? null;
}

/**
 * @param {string} userId
 * @param {object} course
 */
export async function computeCourseProgress(userId, course) {
  const labs = Array.isArray(course.labs) ? course.labs : [];
  let totalSteps = 0;
  let completedSteps = 0;
  /** @type {Array<{ id: string, tool: string, title?: string, completed: boolean, locked: boolean, completedCount: number, totalCount: number }>} */
  const labProgress = [];

  for (let i = 0; i < labs.length; i++) {
    const lab = labs[i];
    const labId = String(lab?.id ?? "");
    const tool = String(lab?.tool ?? "linux");
    const required = getValidatedStepIdsForTool(tool);
    totalSteps += required.length;

    const prevComplete =
      i === 0 ? true : labProgress[i - 1]?.completed === true;
    const locked = i > 0 && !prevComplete;

    const doneIds = await getCourseLabCompletedStepIds(userId, course.id, labId);
    const doneSet = new Set(doneIds);
    const hit = required.filter((sid) => doneSet.has(sid)).length;
    completedSteps += hit;
    const completed = required.length > 0 && hit >= required.length;

    labProgress.push({
      id: labId,
      tool,
      title: typeof lab.title === "string" ? lab.title : undefined,
      completed,
      locked,
      completedCount: hit,
      totalCount: required.length,
    });
  }

  const percent = totalSteps > 0 ? Math.round((100 * completedSteps) / totalSteps) : 0;

  return {
    courseId: course.id,
    percent,
    totalSteps,
    completedSteps,
    labs: labProgress,
  };
}
