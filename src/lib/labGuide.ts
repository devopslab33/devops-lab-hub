import labGuideJson from "@/data/lab-guide.json";

export type LabToolKey = "linux" | "git" | "docker" | "terraform" | "nginx";

export type HintLevel = {
  title: string;
  lines: string[];
};

export type LabStepValidation =
  | {
      type: "command";
      command: string;
      expected: string;
      /** Backend matching mode; default substring (includes expected). */
      match?: "substring" | "regex" | "line";
      regexFlags?: string;
    }
  | { type: "file_exists"; path: string }
  | { type: "port_open"; port: number }
  | { type: "custom" };

/** UI mode; server still uses `validation` only. */
export type StepInteractionType = "command" | "question";

export type StepFailurePattern = {
  contains: string;
  title: string;
  hint: string;
};

export type LabGuideStep = {
  id: string;
  title: string;
  description?: string;
  /** Why this step matters (beginner-friendly). */
  why?: string;
  /** command = default when omitted and step has command validation. */
  interactionType?: StepInteractionType;
  /** Question copy for question steps. */
  question?: string;
  /** Normalized equality against learner input (question steps). */
  acceptableAnswers?: string[];
  /** Single-line command shown in the UI / Copy — never sent to validate API. */
  displayCommand?: string;
  /** Fallback hint when validation fails (shown with friendly title). */
  failureHint?: string;
  /** Match validation output substrings for specific hints. */
  failurePatterns?: StepFailurePattern[];
  validation?: LabStepValidation | null;
};

export type LabGuideEntry = {
  instructionTitle: string;
  welcomeTerminal: string;
  steps: LabGuideStep[];
  hintLevels: HintLevel[];
  detect?: {
    source: string;
    flags?: string;
  };
};

export type StepFailureFeedback = {
  title: string;
  hint?: string;
};

type LabGuideEntryRaw = Omit<LabGuideEntry, "steps"> & { steps: unknown[] };

const guide = labGuideJson as Record<LabToolKey, LabGuideEntryRaw>;

function parseFailurePatterns(raw: unknown): StepFailurePattern[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: StepFailurePattern[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const contains = typeof o.contains === "string" ? o.contains : "";
    const title = typeof o.title === "string" ? o.title : "";
    const hint = typeof o.hint === "string" ? o.hint : "";
    if (!contains || !title) continue;
    out.push({ contains, title, hint });
  }
  return out.length ? out : undefined;
}

function parseAcceptableAnswers(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const arr = raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return arr.length ? arr : undefined;
}

export function normalizeLabGuideSteps(raw: unknown): LabGuideStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, i) => {
    if (typeof entry === "string") {
      return { id: `step-${i + 1}`, title: entry, description: "", validation: undefined };
    }
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === "string" && obj.id ? obj.id : `step-${i + 1}`;
    const interactionRaw = obj.interactionType;
    const interactionType: StepInteractionType | undefined =
      interactionRaw === "question"
        ? "question"
        : interactionRaw === "command"
          ? "command"
          : undefined;
    return {
      id,
      title: typeof obj.title === "string" ? obj.title : "",
      description: typeof obj.description === "string" ? obj.description : "",
      why: typeof obj.why === "string" ? obj.why : undefined,
      interactionType,
      question: typeof obj.question === "string" ? obj.question : undefined,
      acceptableAnswers: parseAcceptableAnswers(obj.acceptableAnswers),
      displayCommand: typeof obj.displayCommand === "string" ? obj.displayCommand : undefined,
      failureHint: typeof obj.failureHint === "string" ? obj.failureHint : undefined,
      failurePatterns: parseFailurePatterns(obj.failurePatterns),
      validation: (obj.validation as LabStepValidation) ?? undefined,
    };
  });
}

export function getLabGuide(tool: string): LabGuideEntry {
  const key = tool as LabToolKey;
  const g = guide[key] ?? guide.linux;
  return {
    ...g,
    steps: normalizeLabGuideSteps(g.steps),
  };
}

export function getHintLevels(tool: string): HintLevel[] {
  return getLabGuide(tool).hintLevels ?? [];
}

function looksLikeInternalValidationCommand(cmd: string): boolean {
  const c = cmd.trim();
  if (!c) return true;
  if (/bash\s+-lc/i.test(c)) return true;
  if (/\|\s*tr\b|\|\s*head\b|--format|\{\{/.test(c)) return true;
  if (/\s&&\s*echo\s+/i.test(c)) return true;
  return false;
}

/** Shell snippet for Copy box — prefers displayCommand; otherwise a simple learner-facing validation command only. */
export function getStepShellCommand(step: LabGuideStep): string | null {
  const v = step.validation;
  if (!v || v.type !== "command") return null;
  if (step.interactionType === "question") return null;
  if (step.displayCommand?.trim()) return step.displayCommand.trim();
  const inner = typeof v.command === "string" ? v.command.trim() : "";
  if (inner && !looksLikeInternalValidationCommand(inner)) return inner;
  return null;
}

export function getStepInteraction(step: LabGuideStep): StepInteractionType | "other" {
  if (step.interactionType === "question") return "question";
  if (step.interactionType === "command") return "command";
  if (step.validation?.type === "command") return "command";
  return "other";
}

export function normalizeAnswerToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function answersMatchAcceptable(step: LabGuideStep, raw: string): boolean {
  const opts = step.acceptableAnswers?.filter(Boolean) ?? [];
  if (step.interactionType === "question" && opts.length === 0) return false;
  if (opts.length === 0) return true;
  const n = normalizeAnswerToken(raw);
  return opts.some((a) => normalizeAnswerToken(a) === n);
}

/** Friendly failure copy for command / question steps (frontend only). */
export function buildStepFailureFeedback(step: LabGuideStep, outputText: string): StepFailureFeedback {
  const out = String(outputText ?? "");
  const lower = out.toLowerCase();

  for (const p of step.failurePatterns ?? []) {
    if (p.contains && lower.includes(p.contains.toLowerCase())) {
      return { title: p.title, hint: p.hint };
    }
  }

  if (lower.includes("cannot connect") || lower.includes("docker daemon") || lower.includes("connection refused")) {
    return {
      title: "Docker isn’t ready",
      hint: "Start Docker Desktop (or the Docker service), wait until it’s running, then try Check again.",
    };
  }

  if (step.id === "step-1" && lower.includes("nginx") === false && out.length < 400) {
    return {
      title: "nginx image not found yet",
      hint: "Run: docker pull nginx — then click Check.",
    };
  }

  return {
    title: "Not quite yet",
    hint: step.failureHint ?? "Run the suggested command in the terminal, then click Check.",
  };
}
