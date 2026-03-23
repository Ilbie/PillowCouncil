import { z } from "zod";

export const RUN_STAGES = ["opening", "rebuttal", "summary", "final"] as const;
export type RunStage = (typeof RUN_STAGES)[number];

export const RUN_STATUSES = ["draft", "queued", "running", "completed", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const TODO_PRIORITIES = ["high", "medium", "low"] as const;
export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export const TODO_STATUSES = ["pending", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export const DEBATE_INTENSITY_MIN = 1;
export const DEBATE_INTENSITY_MAX = 5;
export const DEBATE_INTENSITY_DEFAULT = 2;
export type DebateIntensity = number;

export const SESSION_LANGUAGES = ["ko", "en", "ja"] as const;
export type SessionLanguage = (typeof SESSION_LANGUAGES)[number];

export const THINKING_INTENSITIES = ["low", "balanced", "deep"] as const;
export type ThinkingIntensity = string;

export type ProviderModelVariantOption = {
  id: string;
  label: string;
  description: string;
  reasoningEffort?: string | null;
};

export type ModelThinkingOption = {
  value: string;
  label: string;
  description: string;
};

export const agentDefinitionSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(240),
  bias: z.string().trim().min(1).max(240),
  style: z.string().trim().min(1).max(240),
  systemPrompt: z.string().trim().min(20).max(2400)
});

export type AgentDefinition = z.output<typeof agentDefinitionSchema>;

export const presetDefinitionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  agents: z.array(agentDefinitionSchema).min(2).max(8)
}).superRefine((value, context) => {
  const seenKeys = new Set<string>();

  value.agents.forEach((agent, index) => {
    if (seenKeys.has(agent.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agents", index, "key"],
        message: "Agent keys must be unique within a preset"
      });
      return;
    }

    seenKeys.add(agent.key);
  });
});

export type PresetDefinition = z.output<typeof presetDefinitionSchema>;
export type PanelPreset = PresetDefinition;

export const sessionCreateInputSchema = z.object({
  title: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().min(1).max(120).optional()
  ),
  prompt: z.string().trim().min(10).max(4000),
  presetId: z.string().trim().min(1),
  customPreset: presetDefinitionSchema.optional(),
  provider: z.string().trim().min(1).max(50).default("openai"),
  model: z.string().trim().min(1).max(120),
  thinkingIntensity: z.string().trim().min(1).max(120).default("balanced"),
  debateIntensity: z.number().int().min(DEBATE_INTENSITY_MIN).max(DEBATE_INTENSITY_MAX).default(DEBATE_INTENSITY_DEFAULT),
  roundCount: z.number().int().min(4).max(20).default(4),
  language: z.enum(SESSION_LANGUAGES).default("ko")
}).superRefine((value, context) => {
  if (value.customPreset && value.customPreset.id !== value.presetId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customPreset", "id"],
      message: "Custom preset id must match presetId"
    });
  }

  if (value.customPreset && !value.presetId.startsWith("custom:")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presetId"],
      message: "Custom presets must use the custom: id namespace"
    });
  }

  if (value.customPreset && !value.customPreset.id.startsWith("custom:")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customPreset", "id"],
      message: "Custom presets must use the custom: id namespace"
    });
  }
});

export type SessionCreateInput = z.infer<typeof sessionCreateInputSchema>;

export const todoItemSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  priority: z.enum(TODO_PRIORITIES),
  status: z.enum(TODO_STATUSES).default("pending")
});

export type TodoItemInput = z.output<typeof todoItemSchema>;

export const moderatorSummarySchema = z.object({
  keyPoints: z.array(z.string().min(1)).min(2).max(5),
  agreements: z.array(z.string().min(1)).min(1).max(5),
  disagreements: z.array(z.string().min(1)).min(1).max(5),
  risks: z.array(z.string().min(1)).min(1).max(5),
  summary: z.string().min(1).max(1200)
});

export type ModeratorSummary = z.output<typeof moderatorSummarySchema>;

export const decisionSummarySchema = z.object({
  topRecommendation: z.string().min(1).max(1000),
  alternatives: z.array(z.string().min(1)).min(1).max(4),
  risks: z.array(z.string().min(1)).min(1).max(6),
  assumptions: z.array(z.string().min(1)).min(1).max(6),
  openQuestions: z.array(z.string().min(1)).min(1).max(6),
  nextActions: z.array(z.string().min(1)).min(1).max(6),
  finalSummary: z.string().min(1).max(1600),
  todos: z.array(todoItemSchema).min(3).max(8)
});

export type DecisionSummary = z.output<typeof decisionSummarySchema>;

export type ProviderModelOption = {
  id: string;
  label: string;
  description: string;
  family?: string;
  contextWindow?: number | null;
  supportsReasoning?: boolean;
  supportsToolCall?: boolean;
  supportsStructuredOutput?: boolean;
  variants?: ProviderModelVariantOption[];
};

export function getModelThinkingOptions(model: ProviderModelOption | null | undefined): ModelThinkingOption[] {
  if (model?.variants && model.variants.length > 0) {
    return model.variants.map((variant) => ({
      value: variant.id,
      label: variant.label,
      description: variant.description
    }));
  }

  return [
    {
      value: "balanced",
      label: "Balanced",
      description: "Use the model default reasoning profile."
    }
  ];
}

export type ProviderAuthOption = {
  id: string;
  type: "api" | "oauth";
  methodIndex: number;
  label: string;
  description: string;
  envKeys: string[];
  loginUrl?: string | null;
  inputLabel?: string | null;
  inputPlaceholder?: string | null;
  flowKind?: "manual" | "oauth" | null;
};

export type ProviderOption = {
  id: string;
  label: string;
  description: string;
  npmPackage: string;
  apiBaseUrl?: string | null;
  docUrl?: string | null;
  connected: boolean;
  authModes: ProviderAuthOption[];
  models: ProviderModelOption[];
};

export const appSettingsSchema = z.object({
  providerId: z.string().trim().max(120).default(""),
  modelId: z.string().trim().max(240).default(""),
  authMode: z.string().trim().max(120).default("")
});

export type AppSettings = z.output<typeof appSettingsSchema> & {
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  title: string;
  prompt: string;
  presetId: string;
  customPreset: PresetDefinition | null;
  provider: string;
  model: string;
  thinkingIntensity: ThinkingIntensity;
  debateIntensity: DebateIntensity;
  roundCount: number;
  language: SessionLanguage;
  status: RunStatus;
  currentRunId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionRunRecord = {
  id: string;
  sessionId: string;
  status: Exclude<RunStatus, "draft">;
  workerId: string | null;
  claimedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  createdAt: string;
  updatedAt: string;
};

export type RoundRecord = {
  id: string;
  sessionId: string;
  runId: string;
  roundNumber: number;
  stage: RunStage;
  title: string;
  summary: string | null;
  createdAt: string;
};

export type MessageRecord = {
  id: string;
  sessionId: string;
  runId: string;
  roundId: string | null;
  agentKey: string;
  agentName: string;
  role: "agent" | "moderator" | "system";
  kind: "opinion" | "rebuttal" | "summary" | "final";
  content: string;
  createdAt: string;
};

export type LiveMessageStatus = "streaming" | "complete";

export type LiveMessageRecord = {
  id: string;
  sessionId: string;
  runId: string;
  roundId: string | null;
  stage: RunStage;
  agentKey: string;
  agentName: string;
  role: MessageRecord["role"];
  kind: MessageRecord["kind"];
  content: string;
  reasoning: string;
  createdAt: string;
  status: LiveMessageStatus;
};

type RunStreamEventBase = {
  sessionId: string;
  runId: string;
  createdAt: string;
};

type RunStreamMessageEventBase = RunStreamEventBase & {
  messageId: string;
  roundId: string | null;
  stage: RunStage;
  agentKey: string;
  agentName: string;
  role: MessageRecord["role"];
  kind: MessageRecord["kind"];
};

export type RunStreamEvent =
  | (RunStreamEventBase & {
      type: "status";
      status: "run-started" | "round-started";
      stage: RunStage | null;
      roundId?: string;
      title?: string;
    })
  | (RunStreamMessageEventBase & {
      type: "text-delta";
      delta: string;
      snapshot: string;
    })
  | (RunStreamMessageEventBase & {
      type: "reasoning-delta";
      delta: string;
      snapshot: string;
    })
  | (RunStreamMessageEventBase & {
      type: "message-complete";
      content: string;
      reasoning: string;
    })
  | (RunStreamEventBase & {
      type: "run-complete";
    })
  | (RunStreamEventBase & {
      type: "run-error";
      error: string;
    });

export type DecisionRecord = {
  id: string;
  sessionId: string;
  runId: string;
  topRecommendation: string;
  alternatives: string[];
  risks: string[];
  assumptions: string[];
  openQuestions: string[];
  nextActions: string[];
  finalSummary: string;
  createdAt: string;
};

export type TodoRecord = {
  id: string;
  sessionId: string;
  runId: string;
  title: string;
  description: string;
  priority: TodoPriority;
  status: TodoStatus;
  createdAt: string;
};

export type UsageSummary = {
  totalPromptTokens: number;
  totalCompletionTokens: number;
};

export type SessionSummary = {
  session: SessionRecord;
  run: SessionRunRecord | null;
};

export type SessionDetailResponse = {
  session: SessionRecord;
  run: SessionRunRecord | null;
  rounds: Array<RoundRecord & { messages: MessageRecord[] }>;
  decision: DecisionRecord | null;
  todos: TodoRecord[];
  usage: UsageSummary;
};
