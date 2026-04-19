import Docker from "dockerode";
import { finished } from "node:stream/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import {
  getAllRunningLabs,
  createLabRecord,
  getExpiredRunningLabs,
  getLabRecordById,
  getRunningLabsByUser,
  updateLabStatus,
} from "./db.js";
import { getToolConfig } from "./toolRegistry.js";

const __labSessionsDir = dirname(fileURLToPath(import.meta.url));
let LAB_GUIDE = {};
try {
  LAB_GUIDE = JSON.parse(readFileSync(join(__labSessionsDir, "..", "src", "data", "lab-guide.json"), "utf-8"));
} catch {
  LAB_GUIDE = {};
}

function sendControlJson(socket, payload) {
  if (socket.readyState !== 1) return;
  socket.send(JSON.stringify(payload));
}

/** Raw PTY bytes only (binary WebSocket frame). Never UTF-8–stringify Docker chunks. */
function sendPtyBinary(socket, buf) {
  if (socket.readyState !== 1) return;
  if (!buf || buf.length === 0) return;
  socket.send(buf, { binary: true });
}

function checkTaskCompletion(sessionState, tool, chunk) {
  if (!sessionState || sessionState.taskDone) return null;
  const guide = LAB_GUIDE[tool];
  if (!guide?.detect?.source) return null;
  sessionState.inputTail = (sessionState.inputTail + chunk).slice(-14000);
  try {
    const re = new RegExp(guide.detect.source, guide.detect.flags ?? "");
    if (re.test(sessionState.inputTail)) {
      sessionState.taskDone = true;
      return { toast: true, message: "Task completed!" };
    }
  } catch {
    return null;
  }
  return null;
}

const docker =
  process.platform === "win32"
    ? new Docker({ socketPath: "//./pipe/docker_engine" })
    : new Docker();
const LAB_DURATION_MS = 2 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const liveSockets = new Map();
const imagePullPromises = new Map();
const exposedHostPortsCache = new Map();
const sessionInspectCache = new Map();
const EXPOSED_HOST_PORTS_CACHE_MS = 2000;
let cleanupInterval = null;

/** @param {Record<string, unknown>} containerInfo */
function getContainerPorts(containerInfo) {
  const ports = containerInfo?.NetworkSettings?.Ports || {};
  const result = [];
  for (const key in ports) {
    if (!Object.prototype.hasOwnProperty.call(ports, key)) continue;
    const bindings = ports[key];
    if (bindings) {
      bindings.forEach((b) => {
        if (b && b.HostPort) {
          result.push(String(b.HostPort));
        }
      });
    }
  }
  return [...new Set(result)].sort((a, b) => Number(a) - Number(b));
}

function getExposedPorts(containerInfo) {
  return getContainerPorts(containerInfo);
}

/** @param {Record<string, unknown>} inspectInfo */
function getPublishedTcpContainerPorts(inspectInfo) {
  const ports = inspectInfo?.NetworkSettings?.Ports || {};
  const out = [];
  for (const key of Object.keys(ports)) {
    const m = key.match(/^(\d+)\/tcp$/);
    if (!m || !ports[key]?.[0]?.HostPort) continue;
    out.push(m[1]);
  }
  return [...new Set(out)].sort((a, b) => Number(a) - Number(b));
}

async function getSessionContainerInspectCached(record) {
  if (!record?.container_id) return null;
  const cacheKey = record.id;
  const now = Date.now();
  const hit = sessionInspectCache.get(cacheKey);
  if (hit && now - hit.at < EXPOSED_HOST_PORTS_CACHE_MS) {
    return hit.inspect;
  }
  const inspect = await docker.getContainer(record.container_id).inspect();
  sessionInspectCache.set(cacheKey, { inspect, at: now });
  const hostPorts = getExposedPorts(inspect);
  exposedHostPortsCache.set(cacheKey, { ports: hostPorts, at: now });
  return inspect;
}

async function collectExecShellOutput(containerId, command, { interpreter = "/bin/bash", flag = "-lc" } = {}) {
  const container = docker.getContainer(containerId);
  const exec = await container.exec({
    Cmd: [interpreter, flag, command],
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  });
  const stream = await exec.start({
    hijack: true,
    stdin: false,
    _body: { Tty: true, Detach: false },
  });
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  await finished(stream, { signal: AbortSignal.timeout(25_000) });
  return Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))).toString("utf8").trim();
}

async function collectExecBashOutput(containerId, bashCommand) {
  return collectExecShellOutput(containerId, bashCommand, { interpreter: "/bin/bash", flag: "-lc" });
}

async function collectExecShOutput(containerId, shCommand) {
  return collectExecShellOutput(containerId, shCommand, { interpreter: "/bin/sh", flag: "-c" });
}

function normalizeGuideSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((entry, i) => {
    if (typeof entry === "string") {
      return {
        id: `step-${i + 1}`,
        title: entry,
        description: "",
        interactionType: undefined,
        acceptableAnswers: undefined,
        failureHint: undefined,
        validation: null,
      };
    }
    const id = typeof entry.id === "string" && entry.id ? entry.id : `step-${i + 1}`;
    const acceptableAnswers = Array.isArray(entry.acceptableAnswers)
      ? entry.acceptableAnswers.filter((a) => typeof a === "string" && a.trim())
      : undefined;
    const interactionType =
      entry.interactionType === "question"
        ? "question"
        : entry.interactionType === "command"
          ? "command"
          : undefined;
    return {
      id,
      title: typeof entry.title === "string" ? entry.title : "",
      description: typeof entry.description === "string" ? entry.description : "",
      interactionType,
      acceptableAnswers,
      failureHint: typeof entry.failureHint === "string" ? entry.failureHint : undefined,
      validation: entry.validation && typeof entry.validation === "object" ? entry.validation : null,
    };
  });
}

/** @param {string} raw */
function normalizeAnswerToken(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** @param {string} raw @param {string[] | undefined} list */
function answerMatchesAcceptableList(raw, list) {
  if (!list || list.length === 0) return false;
  const n = normalizeAnswerToken(raw);
  return list.some((a) => normalizeAnswerToken(a) === n);
}

function pickExecRunner(containerId, tool) {
  return tool === "nginx"
    ? (cmd) => collectExecShOutput(containerId, cmd)
    : (cmd) => collectExecBashOutput(containerId, cmd);
}

const VALIDATION_OUTPUT_MAX = 8000;

function truncateValidationOutput(text) {
  const s = String(text ?? "");
  return s.length > VALIDATION_OUTPUT_MAX ? `${s.slice(0, VALIDATION_OUTPUT_MAX)}…` : s;
}

function assertSafePathForTest(path) {
  const s = String(path ?? "");
  if (!s || s.length > 512) return false;
  return /^[\w./~\-]+$/.test(s);
}

async function runStepValidation(containerId, tool, validation) {
  const run = pickExecRunner(containerId, tool);
  const v = validation;
  if (!v?.type) {
    throw new Error("Invalid validation");
  }

  if (v.type === "custom") {
    return { output: "", pass: false };
  }

  if (v.type === "command") {
    const cmd = typeof v.command === "string" ? v.command : "";
    const expected = typeof v.expected === "string" ? v.expected : "";
    const matchMode = typeof v.match === "string" ? v.match : "substring";
    if (!cmd) throw new Error("Missing command");
    const out = await run(cmd);
    let pass = false;
    if (!expected) {
      pass = false;
    } else if (matchMode === "regex") {
      try {
        const flags = typeof v.regexFlags === "string" ? v.regexFlags : "";
        pass = new RegExp(expected, flags).test(out);
      } catch {
        pass = false;
      }
    } else if (matchMode === "line") {
      const lines = out.split(/\r?\n/);
      pass = lines.some((line) => line.trim() === expected.trim());
    } else {
      pass = out.includes(expected);
    }
    return { output: out, pass };
  }

  if (v.type === "file_exists") {
    const path = typeof v.path === "string" ? v.path : "";
    if (!assertSafePathForTest(path)) throw new Error("Invalid path");
    const q = `'${path.replace(/'/g, "'\\''")}'`;
    const out = await run(`if [ -e ${q} ]; then echo __FILE_OK__; else echo __MISSING__; fi`);
    return { output: out, pass: out.includes("__FILE_OK__") };
  }

  if (v.type === "port_open") {
    const port = Number(v.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
    const out = await run(
      `port=${port}; if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 "$port" 2>/dev/null; then echo __PORT_OK__; elif wget -q --spider --timeout=1 "http://127.0.0.1:$port/" 2>/dev/null; then echo __PORT_OK__; else echo __PORT_CLOSED__; fi`,
    );
    return { output: out, pass: out.includes("__PORT_OK__") };
  }

  throw new Error("Unknown validation type");
}

/**
 * @param {string} sessionId
 * @param {string} stepId
 * @param {{ answer?: string }} [opts]
 * @returns {Promise<{ success: boolean, output: string, message: string, hint?: string } | { notFound: true } | { badRequest: true, message: string, hint?: string }>}
 */
export async function validateLabStep(sessionId, stepIdRaw, opts = {}) {
  const stepId = String(stepIdRaw ?? "").trim();
  if (!stepId || !/^[\w.-]+$/.test(stepId)) {
    return { badRequest: true, message: "Invalid stepId" };
  }

  const answer = typeof opts.answer === "string" ? opts.answer : "";

  await assertDockerAvailable();
  const record = getLabRecordById(sessionId);
  if (!record || record.status !== "running") {
    return { notFound: true };
  }

  const exists = await markStoppedIfMissing(record);
  if (!exists) {
    return { notFound: true };
  }

  const guide = LAB_GUIDE[record.tool];
  const steps = normalizeGuideSteps(guide?.steps ?? []);
  const step = steps.find((s) => s.id === stepId);
  if (!step?.validation) {
    return { badRequest: true, message: "No validation configured for this step" };
  }

  const hintDefault = typeof step.failureHint === "string" ? step.failureHint : undefined;
  const acceptable = Array.isArray(step.acceptableAnswers) ? step.acceptableAnswers : [];

  if (step.interactionType === "question" && acceptable.length > 0) {
    if (!answer.trim()) {
      return {
        success: false,
        output: "",
        message: "Answer required",
        hint: hintDefault ?? "Type your answer, then submit.",
      };
    }
    if (!answerMatchesAcceptableList(answer, acceptable)) {
      const first = acceptable[0] ?? "docker ps";
      return {
        success: false,
        output: "",
        message: "That answer isn’t correct yet",
        hint: hintDefault ?? `Try: ${first}`,
      };
    }
  }

  let rawOutput = "";
  try {
    const { output, pass } = await runStepValidation(record.container_id, record.tool, step.validation);
    rawOutput = output;
    const outputTrim = truncateValidationOutput(rawOutput);
    if (pass) {
      return { success: true, output: outputTrim, message: "Step completed" };
    }
    return {
      success: false,
      output: outputTrim,
      message: "Condition not met yet",
      hint: hintDefault ?? "Check the lab instructions, fix the environment, then try again.",
    };
  } catch (error) {
    const msg = formatDockerError(error);
    return {
      success: false,
      output: truncateValidationOutput(msg),
      message: "Validation error",
      hint: hintDefault ?? "Fix the issue shown above, then try again.",
    };
  }
}

/** Resolve /lab/:sessionId/:token to a host port. Token may be container TCP port or literal host port (inspect only). */
function resolveLabProxyPortToken(_record, token, inspectInfo) {
  const portsObj = inspectInfo?.NetworkSettings?.Ports || {};
  /** @type {Record<string, string>} */
  const containerToHost = {};
  for (const key of Object.keys(portsObj)) {
    const m = key.match(/^(\d+)\/tcp$/);
    if (!m || !portsObj[key]?.[0]?.HostPort) continue;
    containerToHost[m[1]] = String(portsObj[key][0].HostPort);
  }
  const hostPorts = new Set(getExposedPorts(inspectInfo));

  if (containerToHost[token]) {
    return { ok: true, hostPort: containerToHost[token] };
  }

  if (hostPorts.has(token)) {
    return { ok: true, hostPort: token };
  }

  return { ok: false, status: 403, statusText: "Invalid port" };
}

function formatDockerError(error) {
  if (error && typeof error === "object") {
    const maybeError = error;
    const message = maybeError.message ?? "";

    if (maybeError.code === "ENOENT" || message.includes("docker_engine")) {
      return `Docker is not reachable on ${os.platform()}. Start Docker Desktop and wait until the engine is running, then try again.`;
    }

    if (maybeError.code === "ECONNREFUSED") {
      return "Docker daemon refused the connection. Start Docker Desktop or the Docker service and retry.";
    }
  }

  return error instanceof Error ? error.message : "Docker operation failed";
}

async function assertDockerAvailable() {
  try {
    await docker.ping();
  } catch (error) {
    throw new Error(formatDockerError(error));
  }
}

/** Ensures a user-defined bridge exists (e.g. lab-net) so NetworkMode can reference it. */
async function ensureUserDefinedBridgeNetwork(networkName) {
  if (!networkName) return;
  await assertDockerAvailable();
  try {
    await docker.getNetwork(networkName).inspect();
    return;
  } catch (err) {
    if (err?.statusCode !== 404) {
      throw new Error(formatDockerError(err));
    }
  }
  try {
    await docker.createNetwork({ Name: networkName, Driver: "bridge" });
  } catch (err) {
    if (err?.statusCode === 409) return;
    throw new Error(formatDockerError(err));
  }
}

function sanitizeNamePart(value) {
  return (value ?? "guest")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

async function ensureImage(imageName) {
  await assertDockerAvailable();

  if (imagePullPromises.has(imageName)) {
    return imagePullPromises.get(imageName);
  }

  const promise = (async () => {
    try {
      await docker.getImage(imageName).inspect();
    } catch (error) {
      try {
        const stream = await docker.pull(imageName);
        await new Promise((resolve, reject) => {
          docker.modem.followProgress(stream, (followError) => (followError ? reject(followError) : resolve()));
        });
      } catch (pullError) {
        throw new Error(formatDockerError(pullError ?? error));
      }
    }
  })();
  imagePullPromises.set(imageName, promise);

  try {
    await promise;
  } finally {
    imagePullPromises.delete(imageName);
  }
}

async function getRunningContainerIds() {
  await assertDockerAvailable();
  const containers = await docker.listContainers();
  return new Set(containers.map((container) => container.Id));
}

async function containerExists(containerId) {
  await assertDockerAvailable();
  const containers = await docker.listContainers();
  return containers.some((container) => container.Id.startsWith(containerId) || containerId.startsWith(container.Id));
}

async function markStoppedIfMissing(record) {
  const exists = await containerExists(record.container_id);
  if (!exists && record.status === "running") {
    updateLabStatus(record.id, "stopped");
    return false;
  }
  return exists;
}

function hostPortFromInspect(inspectInfo, containerTcpPort) {
  const key = `${containerTcpPort}/tcp`;
  const binding = inspectInfo?.NetworkSettings?.Ports?.[key];
  if (!Array.isArray(binding) || !binding[0]?.HostPort) return null;
  return String(binding[0].HostPort);
}

/**
 * Browser-slot hints from Docker inspect (host ports). No activeSlots / port_map filtering.
 */
export async function getLabBrowserSlots(sessionId) {
  const record = getLabRecordById(sessionId);
  if (!record || record.status !== "running") {
    return { error: "not_found" };
  }

  const exists = await markStoppedIfMissing(record);
  if (!exists) {
    return { error: "not_found" };
  }

  let inspectInfo;
  try {
    inspectInfo = await getSessionContainerInspectCached(record);
  } catch {
    return { error: "not_found" };
  }
  if (!inspectInfo) {
    return {
      activeSlots: [],
      publishedSlots: [],
      detectedLabVmPorts: [],
      source: "inspect_failed",
    };
  }

  const hostStrings = getExposedPorts(inspectInfo);
  const asNums = hostStrings.map((h) => Number(h)).filter((n) => Number.isFinite(n));

  if (record.tool !== "docker") {
    const containerPorts = getPublishedTcpContainerPorts(inspectInfo).map((p) => Number(p)).filter((n) => Number.isFinite(n));
    return {
      activeSlots: containerPorts,
      publishedSlots: containerPorts,
      detectedLabVmPorts: containerPorts,
      source: containerPorts.length ? "static" : "none",
    };
  }

  return {
    activeSlots: asNums,
    publishedSlots: asNums,
    detectedLabVmPorts: asNums,
    source: asNums.length ? "inspect" : "none",
  };
}

function resolvePublishTcpPorts(toolConfig) {
  if (Array.isArray(toolConfig.publishContainerPorts) && toolConfig.publishContainerPorts.length > 0) {
    return toolConfig.publishContainerPorts.map((p) => Number(p)).filter((n) => Number.isFinite(n));
  }
  if (typeof toolConfig.publishContainerPort === "number") {
    return [toolConfig.publishContainerPort];
  }
  return [];
}

function defaultProxyContainerPortKey(toolConfig, publishPorts) {
  if (toolConfig.labProxyDefaultContainerPort != null) {
    return String(toolConfig.labProxyDefaultContainerPort);
  }
  return publishPorts.length ? String(publishPorts[0]) : null;
}

/** Docker DNS hostname for the session lab VM (same network as the lab server). */
function getLabContainerDnsHost(inspectInfo) {
  const name = inspectInfo?.Name;
  if (typeof name !== "string" || !name) return null;
  return name.replace(/^\//, "");
}

function buildLabProxyTarget(inspectInfo, tcpPort) {
  const host = getLabContainerDnsHost(inspectInfo);
  if (!host || !tcpPort) return null;
  return `http://${host}:${tcpPort}`;
}

export async function prepareLabProxyRequest(req) {
  const base = req.originalUrl ?? req.url ?? "/";
  const u = new URL(base, "http://127.0.0.1");
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] !== "lab") {
    return { ok: false, status: 404, statusText: "Not Found" };
  }
  const sessionId = parts[1];
  if (!sessionId) {
    return { ok: false, status: 404, statusText: "Not Found" };
  }

  const record = getLabRecordById(sessionId);
  if (!record || record.status !== "running") {
    return { ok: false, status: 404, statusText: "Lab not running" };
  }

  const exists = await markStoppedIfMissing(record);
  if (!exists) {
    return { ok: false, status: 404, statusText: "Lab not running" };
  }

  const cpRaw = u.searchParams.get("cp");
  const uOut = new URL(base, "http://127.0.0.1");
  uOut.searchParams.delete("cp");
  const searchSuffix = uOut.search || "";

  if (parts.length >= 3 && /^\d+$/.test(parts[2])) {
    const inspectInfo = await getSessionContainerInspectCached(record);
    if (!inspectInfo) {
      return { ok: false, status: 500, statusText: "Inspect failed" };
    }
    const resolved = resolveLabProxyPortToken(record, parts[2], inspectInfo);
    if (!resolved.ok) {
      return resolved;
    }
    const target = buildLabProxyTarget(inspectInfo, resolved.hostPort);
    if (!target) {
      return { ok: false, status: 500, statusText: "Lab container hostname unavailable" };
    }
    const rest = parts.length > 3 ? `/${parts.slice(3).join("/")}` : "/";
    req._labProxyTarget = target;
    req._labProxyPath = rest + searchSuffix;
    return { ok: true };
  }

  const inspectInfo = await getSessionContainerInspectCached(record);
  const exposedHosts = inspectInfo ? getExposedPorts(inspectInfo) : [];

  if (exposedHosts.length === 1) {
    const target = buildLabProxyTarget(inspectInfo, exposedHosts[0]);
    if (!target) {
      return { ok: false, status: 500, statusText: "Lab container hostname unavailable" };
    }
    const restPath = parts.length > 2 ? `/${parts.slice(2).join("/")}` : "/";
    req._labProxyTarget = target;
    req._labProxyPath = restPath + searchSuffix;
    return { ok: true };
  }

  if (exposedHosts.length > 1) {
    if (cpRaw != null && cpRaw !== "") {
      const tcpKey = `${String(cpRaw)}/tcp`;
      const binding = inspectInfo?.NetworkSettings?.Ports?.[tcpKey];
      const hp =
        Array.isArray(binding) && binding[0]?.HostPort ? String(binding[0].HostPort) : null;
      if (hp) {
        const target = buildLabProxyTarget(inspectInfo, hp);
        if (!target) {
          return { ok: false, status: 500, statusText: "Lab container hostname unavailable" };
        }
        const restPath = parts.length > 2 ? `/${parts.slice(2).join("/")}` : "/";
        req._labProxyTarget = target;
        req._labProxyPath = restPath + searchSuffix;
        return { ok: true };
      }
      return {
        ok: false,
        status: 400,
        statusText: `Container port ${cpRaw} is not published on this lab container`,
      };
    }
    return {
      ok: false,
      status: 400,
      statusText: "Multiple ports are exposed. Use /lab/<session>/<hostPort> or ?cp=<containerPort>.",
    };
  }

  if (!record.port && !record.port_map) {
    return { ok: false, status: 400, statusText: "No exposed port for this lab" };
  }

  let hostPort = null;
  if (record.port_map) {
    try {
      const map = JSON.parse(record.port_map);
      const key = cpRaw != null && cpRaw !== "" ? String(cpRaw) : null;
      if (key) {
        if (!map[key]) {
          return { ok: false, status: 400, statusText: `Container port ${cpRaw} is not published for this lab` };
        }
        hostPort = map[key];
      } else {
        hostPort = record.port || Object.values(map)[0] || null;
      }
    } catch {
      hostPort = record.port;
    }
  } else {
    hostPort = record.port;
  }

  if (!hostPort) {
    return { ok: false, status: 400, statusText: "No exposed port for this lab" };
  }

  const inspectForFallback = inspectInfo ?? (await getSessionContainerInspectCached(record));
  const target = buildLabProxyTarget(inspectForFallback, hostPort);
  if (!target) {
    return { ok: false, status: 500, statusText: "Lab container hostname unavailable" };
  }

  const restPath = parts.length > 2 ? `/${parts.slice(2).join("/")}` : "/";
  req._labProxyTarget = target;
  req._labProxyPath = restPath + searchSuffix;
  return { ok: true };
}

export async function createLabSession({ userId, tool }) {
  const toolConfig = getToolConfig(tool);
  await ensureImage(toolConfig.image);

  const sessionId = uuidv4();
  const nameSuffix = sanitizeNamePart(userId);
  const containerName = `devops-lab-${toolConfig.tool}-${nameSuffix}-${sessionId.slice(0, 8)}`;

  const publishPorts = resolvePublishTcpPorts(toolConfig);
  const hostConfig = { ...(toolConfig.hostConfig ?? {}) };
  const labNetOff = process.env.LAB_DOCKER_NETWORK === "0" || process.env.LAB_DOCKER_NETWORK === "off";
  const labNetwork = labNetOff ? null : (process.env.LAB_DOCKER_NETWORK?.trim() || "lab-net");
  if (labNetwork) {
    await ensureUserDefinedBridgeNetwork(labNetwork);
    hostConfig.NetworkMode = labNetwork;
  }
  const exposedPorts = {};
  const portBindings = { ...(hostConfig.PortBindings ?? {}) };
  for (const p of publishPorts) {
    const k = `${p}/tcp`;
    exposedPorts[k] = {};
    portBindings[k] = [{ HostPort: "" }];
  }
  if (publishPorts.length > 0) {
    hostConfig.PortBindings = portBindings;
  }

  let container;
  try {
    const createOpts = {
      Image: toolConfig.image,
      name: containerName,
      Env: toolConfig.env ?? ["TERM=xterm-256color"],
      HostConfig: hostConfig,
      Labels: {
        "devops-lab.session": sessionId,
        "devops-lab.user": userId ?? "guest",
        "devops-lab.tool": toolConfig.tool,
      },
    };
    if (toolConfig.keepAliveCmd) {
      createOpts.Cmd = toolConfig.keepAliveCmd;
    }
    if (publishPorts.length > 0) {
      createOpts.ExposedPorts = exposedPorts;
    }

    container = await docker.createContainer(createOpts);

    await container.start();
  } catch (error) {
    throw new Error(formatDockerError(error));
  }

  const portMap = {};
  if (publishPorts.length > 0) {
    try {
      const info = await container.inspect();
      for (const p of publishPorts) {
        const hp = hostPortFromInspect(info, p);
        if (hp) portMap[String(p)] = hp;
      }
    } catch {
      /* ignore */
    }
  }

  const defKey = defaultProxyContainerPortKey(toolConfig, publishPorts);
  const hostPort =
    defKey && portMap[defKey] ? portMap[defKey] : publishPorts.length ? (Object.values(portMap)[0] ?? null) : null;
  const portMapJson = Object.keys(portMap).length > 0 ? JSON.stringify(portMap) : null;

  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + LAB_DURATION_MS).toISOString();

  createLabRecord({
    id: sessionId,
    user_id: userId ?? "guest",
    tool: toolConfig.tool,
    tool_name: toolConfig.displayName,
    container_id: container.id,
    container_name: containerName,
    status: "running",
    created_at: createdAt,
    expires_at: expiresAt,
    port: hostPort,
    port_map: portMapJson,
  });

  const url = hostPort ? `/lab/${sessionId}` : null;
  const publishedContainerPorts =
    Object.keys(portMap).length > 0
      ? Object.keys(portMap)
          .map((k) => Number(k))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b)
      : [...publishPorts].sort((a, b) => a - b);

  return {
    sessionId,
    containerId: container.id,
    containerName,
    tool: toolConfig.tool,
    toolName: toolConfig.displayName,
    status: "running",
    createdAt,
    expiresAt,
    wsPath: `/ws?sessionId=${sessionId}`,
    url,
    publishedContainerPorts,
  };
}

export async function attachLabSocket(sessionId, socket) {
  await assertDockerAvailable();

  const record = getLabRecordById(sessionId);
  if (!record || record.status !== "running") {
    socket.close(4404, "Session not found");
    return;
  }

  const exists = await markStoppedIfMissing(record);
  if (!exists) {
    socket.close(4404, "Container no longer exists");
    return;
  }

  const previousLive = liveSockets.get(sessionId);
  if (previousLive) {
    if (previousLive.pingInterval) clearInterval(previousLive.pingInterval);
    try {
      previousLive.stream?.off("data", previousLive.outputHandler);
      previousLive.stream?.end?.();
    } catch {
      /* ignore */
    }
    try {
      if (previousLive.socket && previousLive.socket.readyState === 1) {
        previousLive.socket.close(4000, "Superseded by a new client");
      }
    } catch {
      /* ignore */
    }
    liveSockets.delete(sessionId);
  }

  const container = docker.getContainer(record.container_id);
  let exec;
  let stream;

  try {
    exec = await container.exec({
      Cmd: ["/bin/bash"],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    // Exec create already sets Tty: true, but exec/start must also request a TTY in the JSON body.
    // Otherwise Docker returns a multiplexed hijacked stream (8-byte stream headers), which shows up as garbage bytes before prompts.
    stream = await exec.start({
      hijack: true,
      stdin: true,
      _body: { Tty: true, Detach: false },
    });
  } catch (error) {
    socket.close(4500, formatDockerError(error));
    return;
  }

  const outputHandler = (chunk) => {
    if (socket.readyState !== 1) return;
    if (chunk == null) return;
    let buf;
    if (Buffer.isBuffer(chunk)) buf = chunk;
    else if (chunk instanceof Uint8Array) buf = Buffer.from(chunk);
    else if (chunk instanceof ArrayBuffer) buf = Buffer.from(new Uint8Array(chunk));
    else return;
    sendPtyBinary(socket, buf);
  };

  stream.on("data", outputHandler);

  const sessionState = { inputTail: "", taskDone: false };
  const connectionId = Symbol("lab-ws");
  const pingMs = Math.max(10_000, Number(process.env.LAB_WS_PING_INTERVAL_MS) || 25_000);
  const pingInterval = setInterval(() => {
    if (socket.readyState !== 1) return;
    try {
      socket.ping();
    } catch {
      /* ignore */
    }
  }, pingMs);

  liveSockets.set(sessionId, { socket, stream, outputHandler, exec, sessionState, connectionId, pingInterval });

  sendControlJson(socket, {
    type: "ready",
    containerName: record.container_name,
    sessionId: record.id,
    tool: record.tool,
  });

  socket.on("message", async (raw) => {
    try {
      const rawBuf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      const message = JSON.parse(rawBuf.toString("utf8"));
      const live = liveSockets.get(sessionId);

      if (message.type === "input" && typeof message.data === "string") {
        live?.stream?.write(Buffer.from(message.data, "utf8"));
        const completion = live?.sessionState ? checkTaskCompletion(live.sessionState, record.tool, message.data) : null;
        if (completion?.toast && socket.readyState === 1) {
          sendControlJson(socket, {
            type: "toast",
            message: completion.message ?? "Task completed!",
            variant: "success",
          });
        }
        return;
      }

      if (message.type === "resize") {
        const cols = Number(message.cols);
        const rows = Number(message.rows);
        if (Number.isFinite(cols) && Number.isFinite(rows)) {
          await exec.resize({ w: cols, h: rows });
        }
      }
    } catch (error) {
      if (socket.readyState === 1) {
        sendControlJson(socket, {
          type: "error",
          data: error instanceof Error ? error.message : "Terminal message handling failed",
        });
      }
    }
  });

  socket.on("close", () => {
    clearInterval(pingInterval);
    stream.off("data", outputHandler);
    const current = liveSockets.get(sessionId);
    if (current?.connectionId === connectionId) {
      liveSockets.delete(sessionId);
    }
    try {
      stream.end();
    } catch {
      // ignore detached exec stream shutdown issues
    }
  });

  socket.on("error", () => {
    clearInterval(pingInterval);
    socket.close();
  });
}

export async function destroyLabSession(sessionId) {
  const record = getLabRecordById(sessionId);
  if (!record) return false;

  await assertDockerAvailable();

  const live = liveSockets.get(sessionId);
  if (live) {
    if (live.pingInterval) clearInterval(live.pingInterval);
    live.stream.off("data", live.outputHandler);
    liveSockets.delete(sessionId);
  }

  try {
    live?.stream.end();
  } catch {
    // ignore terminal stream shutdown issues
  }

  try {
    if (live?.socket && live.socket.readyState === 1) {
      live.socket.close(1000, "Lab session ended");
    }
  } catch {
    // ignore websocket shutdown issues
  }

  const container = docker.getContainer(record.container_id);

  try {
    await container.stop({ t: 0 });
  } catch {
    // container may already be stopped
  }

  try {
    await container.remove({ force: true });
  } catch {
    // ignore remove failures during cleanup
  }

  updateLabStatus(sessionId, "stopped");
  exposedHostPortsCache.delete(sessionId);
  sessionInspectCache.delete(sessionId);
  return true;
}

/**
 * Routable app ports for the UI: Docker labs return active inner publish slots (container-side);
 * other labs return published container TCP ports from inspect.
 * @param {string} sessionId
 */
export async function getLabSessionPorts(sessionId) {
  const record = getLabRecordById(sessionId);
  if (!record || record.status !== "running") {
    return { error: "not_found" };
  }

  const exists = await markStoppedIfMissing(record);
  if (!exists) {
    return { error: "not_found" };
  }

  try {
    const inspectInfo = await getSessionContainerInspectCached(record);
    if (!inspectInfo) {
      return { error: "inspect_failed" };
    }
    return { ports: getExposedPorts(inspectInfo) };
  } catch {
    return { error: "inspect_failed" };
  }
}

/**
 * Running app containers with published host ports (inner Docker for docker tool, else session container).
 * @param {string} sessionId
 */
export async function getLabApps(sessionId) {
  const record = getLabRecordById(sessionId);
  if (!record || record.status !== "running") {
    return { error: "not_found" };
  }

  const exists = await markStoppedIfMissing(record);
  if (!exists) {
    return { error: "not_found" };
  }

  if (record.tool === "docker") {
    const labContainerId = record.container_id;
    let psOutput = "";
    try {
      psOutput = await collectExecBashOutput(
        labContainerId,
        "docker ps --format '{{.ID}}\t{{.Image}}\t{{.Names}}' 2>/dev/null",
      );
    } catch (err) {
      console.log("[getLabApps] docker ps failed:", err);
      return { containers: [] };
    }
    console.log("[getLabApps] docker ps output:", psOutput);

    const parsedRows = psOutput
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("\t");
        return {
          id: (parts[0] ?? "").trim(),
          image: (parts[1] ?? "").trim(),
          name: (parts[2] ?? "").trim(),
        };
      })
      .filter((r) => r.id);

    const containers = [];
    for (const row of parsedRows) {
      let inspectOutput = "";
      try {
        inspectOutput = await collectExecBashOutput(
          labContainerId,
          `docker inspect ${row.id} 2>/dev/null`,
        );
      } catch (err) {
        console.log("[getLabApps] docker inspect failed for", row.id, err);
        continue;
      }
      console.log("[getLabApps] inspect output for", row.id, inspectOutput.slice(0, 800));

      let info;
      try {
        const parsed = JSON.parse(inspectOutput.trim());
        info = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch (err) {
        console.log("[getLabApps] JSON.parse failed for", row.id, err);
        continue;
      }
      if (!info || typeof info !== "object") continue;

      const ports = getContainerPorts(info);
      if (ports.length === 0) continue;

      const nameFromInspect =
        typeof info.Name === "string" ? info.Name.replace(/^\//, "") : "";
      const imageFromInspect = info.Config?.Image != null ? String(info.Config.Image) : "";

      containers.push({
        id: typeof info.Id === "string" ? info.Id : row.id,
        name: row.name || nameFromInspect,
        image: row.image || imageFromInspect,
        ports,
      });
    }

    console.log("[getLabApps] Final containers:", containers);
    return { containers };
  }

  try {
    const inspectInfo = await getSessionContainerInspectCached(record);
    if (!inspectInfo) {
      return { containers: [] };
    }
    const portList = getContainerPorts(inspectInfo);
    if (!portList.length) {
      return { containers: [] };
    }
    return {
      containers: [
        {
          id: record.container_id,
          name: record.container_name || "",
          image: inspectInfo.Config?.Image != null ? String(inspectInfo.Config.Image) : "",
          ports: portList,
        },
      ],
    };
  } catch {
    return { containers: [] };
  }
}

export async function getActiveLabs(userId) {
  const records = getRunningLabsByUser(userId);
  const runningContainers = await getRunningContainerIds();
  const activeLabs = [];

  for (const record of records) {
    const isRunning = runningContainers.has(record.container_id);
    if (!isRunning) {
      updateLabStatus(record.id, "stopped");
      continue;
    }

    let publishedContainerPorts = [];
    if (record.port_map) {
      try {
        publishedContainerPorts = Object.keys(JSON.parse(record.port_map))
          .map((k) => Number(k))
          .filter((n) => Number.isFinite(n))
          .sort((a, b) => a - b);
      } catch {
        publishedContainerPorts = [];
      }
    } else if (record.port) {
      const cfg = getToolConfig(record.tool);
      const def = cfg.labProxyDefaultContainerPort ?? cfg.publishContainerPort;
      if (def != null) {
        publishedContainerPorts = [Number(def)];
      } else {
        const slots = resolvePublishTcpPorts(cfg);
        publishedContainerPorts = slots.length ? [slots[0]] : [];
      }
    }

    activeLabs.push({
      id: record.id,
      userId: record.user_id,
      tool: record.tool,
      toolName: record.tool_name,
      containerId: record.container_id,
      containerName: record.container_name,
      status: record.status,
      createdAt: record.created_at,
      expiresAt: record.expires_at,
      wsPath: `/ws?sessionId=${record.id}`,
      url: record.port ? `/lab/${record.id}` : null,
      publishedContainerPorts,
    });
  }

  return activeLabs;
}

export async function runCleanupCycle() {
  const expired = getExpiredRunningLabs(new Date().toISOString());
  for (const record of expired) {
    await destroyLabSession(record.id);
  }

  const runningRecords = getAllRunningLabs();
  for (const record of runningRecords) {
    await markStoppedIfMissing(record);
  }
}

export function startCleanupScheduler() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    void runCleanupCycle();
  }, CLEANUP_INTERVAL_MS);
}

export async function shutdownAllSessions() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export { formatDockerError };
