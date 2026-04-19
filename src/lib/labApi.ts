export type LabSessionResponse = {
  sessionId: string;
  containerId: string;
  containerName: string;
  tool: string;
  toolName: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  wsPath: string;
  url: string | null;
  publishedContainerPorts?: number[];
};

export type LabBrowserSlotsResponse = {
  /** Ports that are both published on the session container and mapped by a running inner container (browser can open these). */
  activeSlots: number[];
  /** All host-routable lab-VM slots for this session (from DB). */
  publishedSlots: number[];
  /** All lab-VM left-hand ports seen on running inner containers (`docker port`), before filtering to browser-routable slots. */
  detectedLabVmPorts: number[];
  source: string;
};

export async function fetchLabBrowserSlots(sessionId: string) {
  const response = await fetch(`/api/labs/${encodeURIComponent(sessionId)}/browser-slots`);
  return parseJson<LabBrowserSlotsResponse>(response);
}

export type LabPortsResponse = {
  ports: string[];
};

export async function fetchLabPorts(sessionId: string) {
  const response = await fetch(`/api/labs/${encodeURIComponent(sessionId)}/ports`);
  return parseJson<LabPortsResponse>(response);
}

export type LabAppContainer = {
  id: string;
  name: string;
  image: string;
  ports: string[];
};

export type LabAppsResponse = {
  containers: LabAppContainer[];
};

export async function fetchLabApps(sessionId: string) {
  const response = await fetch(`/api/labs/${encodeURIComponent(sessionId)}/apps`);
  return parseJson<LabAppsResponse>(response);
}

export type ActiveLabResponse = {
  id: string;
  userId: string;
  tool: string;
  toolName: string;
  containerId: string;
  containerName: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  wsPath: string;
  url: string | null;
  publishedContainerPorts?: number[];
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Request failed";

    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // ignore malformed error responses
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function startLabSession(payload: { userId?: string; tool: string }) {
  const response = await fetch("/api/labs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJson<LabSessionResponse>(response);
}

export type ValidateLabStepResponse = {
  success: boolean;
  output: string;
  message: string;
  hint?: string;
};

export type LabProgressResponse = {
  completedSteps: string[];
};

export async function fetchLabProgress(sessionId: string, userId: string): Promise<LabProgressResponse> {
  const response = await fetch(
    `/api/labs/${encodeURIComponent(sessionId)}/progress?userId=${encodeURIComponent(userId)}`,
  );
  return parseJson<LabProgressResponse>(response);
}

export type CourseProgressPayload = {
  percent: number;
  totalSteps: number;
  completedSteps: number;
  courseId: string;
  labs: {
    id: string;
    tool: string;
    title?: string;
    completed: boolean;
    locked: boolean;
    completedCount: number;
    totalCount: number;
  }[];
};

export type CourseSummary = {
  id: string;
  title: string;
  description?: string;
  plan?: "free" | "pro";
  labs: { id: string; tool: string; title?: string }[];
  percent?: number;
};

export type UserSubscription = {
  plan: "free" | "pro";
  status: "active" | "inactive";
  expiresAt: string | null;
};

export async function fetchUserSubscription(userId: string): Promise<UserSubscription> {
  const response = await fetch(`/api/user/subscription?userId=${encodeURIComponent(userId)}`);
  return parseJson<UserSubscription>(response);
}

export async function postSimulatedProUpgrade(userId: string): Promise<UserSubscription> {
  const response = await fetch("/api/user/subscription/upgrade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  return parseJson<UserSubscription>(response);
}

export async function fetchCoursesList(userId?: string): Promise<{ courses: CourseSummary[] }> {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const response = await fetch(`/api/courses${q}`);
  return parseJson<{ courses: CourseSummary[] }>(response);
}

export async function fetchCourseById(courseId: string): Promise<{ course: CourseSummary }> {
  const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}`);
  return parseJson<{ course: CourseSummary }>(response);
}

export async function fetchCourseProgress(courseId: string, userId: string): Promise<CourseProgressPayload> {
  const response = await fetch(
    `/api/courses/${encodeURIComponent(courseId)}/progress?userId=${encodeURIComponent(userId)}`,
  );
  return parseJson<CourseProgressPayload>(response);
}

export async function postLabStepValidation(
  sessionId: string,
  stepId: string,
  userId?: string,
  course?: { courseId: string; courseLabId: string },
  answer?: string,
): Promise<ValidateLabStepResponse> {
  const response = await fetch(`/api/labs/${encodeURIComponent(sessionId)}/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stepId,
      ...(userId ? { userId } : {}),
      ...(course?.courseId && course?.courseLabId ? { courseId: course.courseId, courseLabId: course.courseLabId } : {}),
      ...(typeof answer === "string" ? { answer } : {}),
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<ValidateLabStepResponse> & { error?: string };

  const hintParsed =
    typeof data.hint === "string" && data.hint.trim() ? data.hint.trim() : undefined;

  if (!response.ok) {
    return {
      success: false,
      output: typeof data.output === "string" ? data.output : "",
      message:
        typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : "Request failed",
      ...(hintParsed ? { hint: hintParsed } : {}),
    };
  }

  return {
    success: Boolean(data.success),
    output: typeof data.output === "string" ? data.output : "",
    message: typeof data.message === "string" ? data.message : "",
    ...(hintParsed ? { hint: hintParsed } : {}),
  };
}

export async function stopLabSession(sessionId: string) {
  const response = await fetch(`/api/labs/${sessionId}`, {
    method: "DELETE",
  });

  return parseJson<void>(response);
}

export async function fetchActiveLabs(userId: string) {
  const response = await fetch(`/api/active-labs?userId=${encodeURIComponent(userId)}`);
  return parseJson<ActiveLabResponse[]>(response);
}

/**
 * PTY traffic uses binary WebSocket frames. Vite's dev proxy can corrupt them — in DEV
 * connect straight to the lab server (same pattern as ttyd / dedicated terminal gateways).
 */
export function buildTerminalWebSocketUrl(wsPath: string) {
  const base = import.meta.env.VITE_LAB_WS_URL?.replace(/\/$/, "");
  if (base) {
    return `${base}${wsPath.startsWith("/") ? wsPath : `/${wsPath}`}`;
  }
  if (import.meta.env.DEV) {
    const port = import.meta.env.VITE_LAB_SERVER_PORT ?? "3001";
    const h = window.location.hostname;
    const host = h === "[::]" || h === "::" ? "localhost" : h;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${host}:${port}${wsPath}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${wsPath}`;
}
