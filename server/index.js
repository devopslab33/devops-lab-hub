import "dotenv/config";
import http from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  attachLabSocket,
  createLabSession,
  destroyLabSession,
  formatDockerError,
  getActiveLabs,
  getLabBrowserSlots,
  prepareLabProxyRequest,
  getLabSessionPorts,
  getLabApps,
  runCleanupCycle,
  shutdownAllSessions,
  startCleanupScheduler,
  validateLabStep,
} from "./labSessions.js";
import { getLabRecordById } from "./db.js";
import { getCompletedStepIds, upsertLabStepPassed } from "./labProgress.js";
import { computeCourseProgress, getCourseById, listCourses } from "./courses.js";
import { getSubscriptionForUser, setUserPlanPro } from "./subscriptions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

const app = express();
const server = http.createServer(app);
const port = Number(process.env.LAB_SERVER_PORT ?? 3001);

const labAppProxy = createProxyMiddleware({
  changeOrigin: true,
  ws: true,
  pathFilter: (pathname) => typeof pathname === "string" && pathname.startsWith("/lab/"),
  router: (req) => req._labProxyTarget,
  pathRewrite: (path, req) => req._labProxyPath ?? "/",
  on: {
    error(_err, req, res) {
      if (res && !res.headersSent && typeof res.writeHead === "function") {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Bad gateway");
      }
    },
  },
});

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/user/subscription", async (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) {
    res.status(400).json({ error: "userId query parameter is required" });
    return;
  }

  try {
    const sub = await getSubscriptionForUser(userId);
    res.json({
      plan: sub.plan === "pro" ? "pro" : "free",
      status: sub.status === "active" ? "active" : "inactive",
      expiresAt: sub.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ error: formatDockerError(error) });
  }
});

app.post("/api/user/subscription/upgrade", async (req, res) => {
  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    const result = await setUserPlanPro(userId);
    if (!result.ok) {
      res.status(503).json({ error: result.error === "not_configured" ? "Subscriptions not configured" : result.error });
      return;
    }
    const sub = await getSubscriptionForUser(userId);
    res.json({
      plan: sub.plan === "pro" ? "pro" : "free",
      status: sub.status === "active" ? "active" : "inactive",
      expiresAt: sub.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ error: formatDockerError(error) });
  }
});

app.get("/api/courses", async (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  const courses = listCourses();

  const shape = (c, percent) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    labs: c.labs,
    plan: c.plan === "pro" ? "pro" : "free",
    ...(typeof percent === "number" ? { percent } : {}),
  });

  if (!userId) {
    res.json({ courses: courses.map((c) => shape(c)) });
    return;
  }

  try {
    const withProgress = await Promise.all(
      courses.map(async (c) => {
        const p = await computeCourseProgress(userId, c);
        return shape(c, p.percent);
      }),
    );
    res.json({ courses: withProgress });
  } catch (error) {
    res.status(500).json({ error: formatDockerError(error) });
  }
});

app.get("/api/courses/:courseId", async (req, res) => {
  const course = getCourseById(req.params.courseId);
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  res.json({ course });
});

app.get("/api/courses/:courseId/progress", async (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) {
    res.status(400).json({ error: "userId query parameter is required" });
    return;
  }

  const course = getCourseById(req.params.courseId);
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  try {
    const progress = await computeCourseProgress(userId, course);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: formatDockerError(error) });
  }
});

app.post("/api/labs", async (req, res) => {
  try {
    const session = await createLabSession(req.body ?? {});
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({
      error: formatDockerError(error),
    });
  }
});

app.get("/api/active-labs", async (req, res) => {
  const userId = String(req.query.userId ?? "");
  if (!userId) {
    res.status(400).json({ error: "userId query parameter is required" });
    return;
  }

  try {
    const labs = await getActiveLabs(userId);
    res.json(labs);
  } catch (error) {
    res.status(500).json({
      error: formatDockerError(error),
    });
  }
});

app.get("/api/labs/:sessionId/browser-slots", async (req, res) => {
  try {
    const result = await getLabBrowserSlots(req.params.sessionId);
    if (result.error === "not_found") {
      res.status(404).json({ error: "Lab not running or not found" });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: formatDockerError(error),
    });
  }
});

app.get("/api/labs/:sessionId/ports", async (req, res) => {
  try {
    const result = await getLabSessionPorts(req.params.sessionId);
    if (result.error === "not_found") {
      res.status(404).json({ error: "Lab not running or not found" });
      return;
    }
    if (result.error === "inspect_failed") {
      res.status(500).json({ error: "Could not inspect lab container" });
      return;
    }
    res.json({ ports: result.ports });
  } catch (error) {
    res.status(500).json({
      error: formatDockerError(error),
    });
  }
});

app.get("/api/labs/:sessionId/apps", async (req, res) => {
  try {
    const result = await getLabApps(req.params.sessionId);
    if (result.error === "not_found") {
      res.status(404).json({ error: "Lab not running or not found" });
      return;
    }
    res.json({ containers: result.containers ?? [] });
  } catch (error) {
    res.status(500).json({
      error: formatDockerError(error),
    });
  }
});

app.get("/api/labs/:sessionId/progress", async (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) {
    res.status(400).json({ error: "userId query parameter is required" });
    return;
  }

  const record = getLabRecordById(req.params.sessionId);
  if (!record || record.user_id !== userId) {
    res.status(404).json({ error: "Lab session not found" });
    return;
  }

  try {
    const completedSteps = await getCompletedStepIds(userId, req.params.sessionId);
    res.json({ completedSteps });
  } catch (error) {
    res.status(500).json({
      error: formatDockerError(error),
    });
  }
});

app.post("/api/labs/:sessionId/validate", async (req, res) => {
  const stepId = req.body?.stepId;
  if (stepId == null || typeof stepId !== "string" || !stepId.trim()) {
    res.status(400).json({ success: false, output: "", message: "stepId is required" });
    return;
  }

  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  const courseId = typeof req.body?.courseId === "string" ? req.body.courseId.trim() : "";
  const courseLabId = typeof req.body?.courseLabId === "string" ? req.body.courseLabId.trim() : "";
  const answer = typeof req.body?.answer === "string" ? req.body.answer : "";

  try {
    const result = await validateLabStep(req.params.sessionId, stepId, { answer });
    if (result.notFound) {
      res.status(404).json({ success: false, output: "", message: "Lab session not found" });
      return;
    }
    if (result.badRequest) {
      res.status(400).json({
        success: false,
        output: "",
        message: result.message ?? "Invalid request",
        hint: result.hint ?? "",
      });
      return;
    }

    if (result.success && userId) {
      const record = getLabRecordById(req.params.sessionId);
      if (record && record.user_id === userId) {
        if (courseId && courseLabId) {
          await upsertLabStepPassed(userId, req.params.sessionId, stepId.trim(), { courseId, courseLabId });
        } else {
          await upsertLabStepPassed(userId, req.params.sessionId, stepId.trim());
        }
      }
    }

    res.json({
      success: result.success,
      output: result.output,
      message: result.message,
      hint: result.hint ?? "",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      output: "",
      message: formatDockerError(error),
    });
  }
});

app.delete("/api/labs/:sessionId", async (req, res) => {
  try {
    const destroyed = await destroyLabSession(req.params.sessionId);
    if (!destroyed) {
      res.status(404).json({ error: "Lab session not found" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    res.status(500).json({
      error: formatDockerError(error),
    });
  }
});

app.use(async (req, res, next) => {
  const pathname = new URL(req.originalUrl ?? "/", "http://127.0.0.1").pathname;
  if (!pathname.startsWith("/lab/")) {
    next();
    return;
  }
  try {
    const prepared = await prepareLabProxyRequest(req);
    if (!prepared.ok) {
      res.status(prepared.status).type("text/plain").send(prepared.statusText);
      return;
    }
    await labAppProxy(req, res, next);
  } catch {
    res.status(500).type("text/plain").send("Proxy error");
  }
});

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

wss.on("connection", (socket, req) => {
  const url = new URL(req.url ?? "/ws", `http://${req.headers.host}`);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    socket.close(4400, "Missing sessionId");
    return;
  }

  void attachLabSocket(sessionId, socket);
});

server.on("upgrade", (req, socket, head) => {
  let pathname;
  try {
    pathname = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`).pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (pathname.startsWith("/lab/")) {
    void (async () => {
      try {
        const prepared = await prepareLabProxyRequest(req);
        if (!prepared.ok) {
          socket.write(`HTTP/1.1 ${prepared.status} ${prepared.statusText}\r\nConnection: close\r\n\r\n`);
          socket.destroy();
          return;
        }
        labAppProxy.upgrade(req, socket, head);
      } catch {
        socket.destroy();
      }
    })();
    return;
  }

  if (pathname === "/ws" || pathname.startsWith("/ws/")) {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
    return;
  }

  socket.destroy();
});

app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.method !== "GET") {
    next();
    return;
  }
  if (req.path.startsWith("/api") || req.path.startsWith("/lab/")) {
    next();
    return;
  }
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

startCleanupScheduler();
void runCleanupCycle();

server.listen(port, () => {
  console.log(`Lab server listening on http://localhost:${port}`);
});

const shutdown = async () => {
  wss.close();
  await shutdownAllSessions();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
