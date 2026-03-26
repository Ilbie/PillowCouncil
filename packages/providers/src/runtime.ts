import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2";

import { createId, getAppSettings, getDefaultAppSettings, nowIso, type ProviderAuthOption } from "@pillow-council/shared";

import { getProviderOption, loadProviderCatalog } from "./catalog";
import { getOpencodeClient, getOpencodeDirectory } from "./opencode";

export type ProviderUsage = {
  promptTokens: number;
  completionTokens: number;
  mcpCalls: number;
  skillUses: number;
  webSearches: number;
};

export type TextGenerationResult = {
  id: string;
  text: string;
  usage: ProviderUsage;
};

export interface PillowCouncilProvider {
  generateText(input: {
    provider: string;
    model: string;
    variant?: string;
    system: string;
    prompt: string;
    enableWebSearch?: boolean;
    temperature?: number;
    onTextDelta?: (delta: string, snapshot: string) => Promise<void> | void;
    onReasoningDelta?: (delta: string, snapshot: string) => Promise<void> | void;
  }): Promise<TextGenerationResult>;
  generateJson<T>(input: {
    provider: string;
    model: string;
    variant?: string;
    system: string;
    prompt: string;
    schema: z.ZodSchema<T>;
    enableWebSearch?: boolean;
    temperature?: number;
    retries?: number;
  }): Promise<{ data: T; raw: string; usage: ProviderUsage }>;
}

function normalizeUsage(tokens: unknown): ProviderUsage {
  if (!tokens || typeof tokens !== "object") {
    return {
      promptTokens: 0,
      completionTokens: 0,
      mcpCalls: 0,
      skillUses: 0,
      webSearches: 0
    };
  }

  const value = tokens as Record<string, unknown>;
  return {
    promptTokens: Number(value.input ?? 0),
    completionTokens: Number(value.output ?? 0),
    mcpCalls: 0,
    skillUses: 0,
    webSearches: 0
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type ToolActivityPart = {
  id?: string;
  callID?: string;
  type: string;
  tool?: string;
  state?: unknown;
};

function extractOpenCodeErrorMessage(error: unknown): string | null {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (!error || typeof error !== "object") {
    return null;
  }

  if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message.trim() || null;
  }

  if ("data" in error) {
    return extractOpenCodeErrorMessage((error as { data?: unknown }).data);
  }

  if ("error" in error) {
    return extractOpenCodeErrorMessage((error as { error?: unknown }).error);
  }

  return null;
}

export const extractOpenCodeErrorMessageForTests = extractOpenCodeErrorMessage;

function isWebSearchToolName(toolName: string): boolean {
  const normalized = toolName.trim().toLowerCase();
  return /(?:^|[_-])web[_-]?search(?:$|[_-])/.test(normalized) || normalized.includes("codesearch");
}

function getToolPartStateStatus(state: unknown): string | null {
  if (typeof state === "string") {
    return state;
  }

  if (state && typeof state === "object" && "status" in state) {
    const status = (state as { status?: unknown }).status;
    return typeof status === "string" ? status : null;
  }

  return null;
}

const STREAM_DRAIN_TIMEOUT_MS = 100;

function extractActivityUsage(parts: unknown, mcpServerNames: Set<string>): Pick<ProviderUsage, "mcpCalls" | "skillUses" | "webSearches"> {
  const toolParts = Array.isArray(parts)
    ? parts.filter(
        (part): part is ToolActivityPart => Boolean(part) && typeof part === "object" && "type" in part && (part as { type?: unknown }).type === "tool"
      )
    : [];

  const seenCallIds = new Set<string>();
  const mcpPatterns = Array.from(mcpServerNames).map((serverName) => new RegExp(`^${escapeRegex(serverName)}(?:[_-].+)?$`));
  const counts = {
    mcpCalls: 0,
    skillUses: 0,
    webSearches: 0
  };

  for (const part of toolParts) {
    const identifiers = [part.callID, part.id].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (identifiers.length === 0 || identifiers.some((identifier) => seenCallIds.has(identifier))) {
      continue;
    }

    for (const identifier of identifiers) {
      seenCallIds.add(identifier);
    }
    const toolName = typeof part.tool === "string" ? part.tool : "";
    if (!toolName) {
      continue;
    }

    const stateStatus = getToolPartStateStatus(part.state);
    if (stateStatus && stateStatus !== "completed") {
      continue;
    }

    if (toolName === "skill" || toolName.startsWith("skill_")) {
      counts.skillUses += 1;
      continue;
    }

    if (isWebSearchToolName(toolName)) {
      counts.webSearches += 1;
      continue;
    }

    if (mcpPatterns.some((pattern) => pattern.test(toolName))) {
      counts.mcpCalls += 1;
    }
  }

  return counts;
}

export const extractActivityUsageForTests = extractActivityUsage;

async function getConfiguredMcpServerNames(input: {
  client: Awaited<ReturnType<typeof getOpencodeClient>>;
  directory: string;
  globalEnabled: boolean;
}): Promise<Set<string>> {
  if (!input.globalEnabled) {
    return new Set();
  }

  const mcpClient = input.client.mcp;
  if (!mcpClient?.status) {
    return new Set();
  }

  const status = await mcpClient.status({ directory: input.directory });
  if (status.error || !status.data) {
    return new Set();
  }

  return new Set(
    Object.entries(status.data)
      .filter(([, server]) => server.status === "connected")
      .map(([serverName]) => serverName)
  );
}

async function getAvailableSkillNames(input: {
  client: Awaited<ReturnType<typeof getOpencodeClient>>;
  directory: string;
  globalEnabled: boolean;
}): Promise<string[]> {
  if (!input.globalEnabled) {
    return [];
  }

  const appClient = input.client.app;
  if (!appClient?.skills) {
    return [];
  }

  const result = await appClient.skills({ directory: input.directory });
  if (result.error || !result.data) {
    return [];
  }

  return result.data.map((skill) => skill.name).filter((name): name is string => Boolean(name));
}

function buildWebSearchInstruction(input: { structured: boolean }): string {
  const guidance = [
    "Use web search when the answer depends on current events, rapidly changing facts, market conditions, policy updates, or external evidence not already present in the prompt.",
    "Do not search for static reasoning tasks or information already provided in the conversation.",
    input.structured
      ? "If fresh external information would improve the JSON result, call web search before finalizing the answer."
      : "If fresh external information would materially improve accuracy, call web search before finalizing the answer."
  ];

  if (input.structured) {
    guidance.push("Return exactly one structured JSON object.");
  }

  return guidance.join(" ");
}

function createStructuredOutputParseError(error: z.ZodError): Error {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return new Error("Structured output validation failed.");
  }

  const path = firstIssue.path.length > 0 ? firstIssue.path.join(".") : "response";
  return new Error(`Structured output validation failed for ${path}: ${firstIssue.message}`);
}

export const createStructuredOutputParseErrorForTests = createStructuredOutputParseError;

function buildToolUsageInstruction(input: {
  structured: boolean;
  enableWebSearch: boolean;
  mcpServerNames: Set<string>;
  skillNames: string[];
}): string | null {
  const guidance: string[] = [];

  if (input.mcpServerNames.size > 0) {
    guidance.push(`Available MCP servers: ${[...input.mcpServerNames].join(", ")}. Use an MCP server when specialized docs, APIs, or resources from that server are directly relevant.`);
  }

  if (input.skillNames.length > 0) {
    guidance.push(`Available skills: ${input.skillNames.join(", ")}. Load a skill when the task matches its domain expertise or workflow.`);
  }

  if (input.enableWebSearch) {
    guidance.push(buildWebSearchInstruction({ structured: input.structured }));
  }

  if (guidance.length === 0) {
    return null;
  }

  if (input.structured && !input.enableWebSearch) {
    guidance.push("Return exactly one structured JSON object.");
  }

  return guidance.join(" ");
}

function extractText(parts: Array<{ type: string; text?: string }> | undefined): string {
  return (parts ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function extractRequestedAgentCount(prompt: string): number {
  const match = prompt.match(/Generate exactly\s+(\d+)\s+agents\./i);
  return match ? Number(match[1]) : 3;
}

async function ensureProvider(providerId: string) {
  const catalog = await loadProviderCatalog();
  const provider = getProviderOption(providerId, catalog);

  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  return provider;
}

function validateConnectedProvider(providerLabel: string, authModes: ProviderAuthOption[], connected: boolean): void {
  if (!connected) {
    const authLabels = authModes.map((mode) => mode.label).join(", ");
    throw new Error(`${providerLabel} is not connected in OpenCode. Configure ${authLabels || "a login method"} first.`);
  }
}

function resolveEffectiveMcpEnabled(
  value: McpLocalConfig | McpRemoteConfig | { enabled: boolean },
  globalEnabled: boolean
): boolean {
  if (!globalEnabled) {
    return false;
  }

  return "enabled" in value ? value.enabled !== false : true;
}

export async function syncOpenCodeRuntimeSettings(input: {
  client: Awaited<ReturnType<typeof getOpencodeClient>>;
  directory: string;
  settings?: ReturnType<typeof getAppSettings>;
}): Promise<void> {
  const settings = input.settings ?? getSafeAppSettings();
  const configClient = input.client.config;

  if (!configClient?.get || !configClient?.update) {
    return;
  }

  const currentConfig = await configClient.get({ directory: input.directory });
  if (currentConfig.error || !currentConfig.data?.mcp) {
    return;
  }

  const mcpClient = input.client.mcp;
  if (!mcpClient?.connect || !mcpClient?.disconnect) {
    return;
  }

  const desiredStates = Object.entries(currentConfig.data.mcp).map(([serverId, config]) => ({
    serverId,
    enabled: resolveEffectiveMcpEnabled(config, settings.enableMcp)
  }));

  await Promise.all(
    desiredStates.map(({ serverId, enabled }) =>
      enabled
        ? mcpClient.connect({ directory: input.directory, name: serverId }).catch(() => undefined)
        : mcpClient.disconnect({ directory: input.directory, name: serverId }).catch(() => undefined)
    )
  );
}

function getSafeAppSettings(): ReturnType<typeof getAppSettings> {
  try {
    return getAppSettings();
  } catch {
    return getDefaultAppSettings();
  }
}

async function promptOpenCode<T>(input: {
  provider: string;
  model: string;
  variant?: string;
  system: string;
  prompt: string;
  enableWebSearch?: boolean;
  schema?: z.ZodSchema<T>;
  retries?: number;
  onTextDelta?: (delta: string, snapshot: string) => Promise<void> | void;
  onReasoningDelta?: (delta: string, snapshot: string) => Promise<void> | void;
}): Promise<{ id: string; text: string; structured?: unknown; usage: ProviderUsage }> {
  const provider = await ensureProvider(input.provider);
  validateConnectedProvider(provider.label, provider.authModes, provider.connected);
  const model = provider.models.find((item) => item.id === input.model);
  const selectedVariant = model?.variants?.some((variant) => variant.id === input.variant) ? input.variant : undefined;

  const client = await getOpencodeClient();
  const directory = getOpencodeDirectory();
  const settings = getSafeAppSettings();
  await syncOpenCodeRuntimeSettings({ client, directory, settings });
  const mcpServerNames = await getConfiguredMcpServerNames({ client, directory, globalEnabled: settings.enableMcp });
  const skillNames = await getAvailableSkillNames({ client, directory, globalEnabled: settings.enableSkills });
  const created = await client.session.create({
    directory,
    title: `PillowCouncil - ${provider.label}`
  });

  if (created.error || !created.data) {
    throw new Error("Failed to create an OpenCode session");
  }

  const sessionId = created.data.id;
  const shouldStream = Boolean(input.onTextDelta || input.onReasoningDelta);
  const shouldSubscribe = Boolean(client.event?.subscribe);
  let streamClosed = false;
  let promptCompleted = false;
  let streamPromise: Promise<void> | null = null;
  let closeActiveEventStream: (() => Promise<void>) | undefined;

  try {
    const toolUsageInstruction = buildToolUsageInstruction({
      structured: Boolean(input.schema),
      enableWebSearch: Boolean(input.enableWebSearch),
      mcpServerNames,
      skillNames
    });
    const partSnapshots = new Map<string, string>();
    const partTypes = new Map<string, "text" | "reasoning">();

    const emitSnapshot = async (partId: string, partType: "text" | "reasoning", nextSnapshot: string) => {
      const previousSnapshot = partSnapshots.get(partId) ?? "";
      const delta = nextSnapshot.startsWith(previousSnapshot) ? nextSnapshot.slice(previousSnapshot.length) : nextSnapshot;
      partSnapshots.set(partId, nextSnapshot);
      partTypes.set(partId, partType);

      if (!delta) {
        return;
      }

      if (partType === "text") {
        await input.onTextDelta?.(delta, nextSnapshot);
        return;
      }

      await input.onReasoningDelta?.(delta, nextSnapshot);
    };

    const streamedToolParts = new Map<string, ToolActivityPart>();
    streamPromise = shouldSubscribe
      ? (async () => {
          const events = await client.event.subscribe({ directory });
          closeActiveEventStream = async () => {
            await events.stream.return?.(undefined);
          };

          try {
            for await (const event of events.stream) {
              if (streamClosed) {
                break;
              }

              if (event.type === "message.part.updated") {
                const part = event.properties.part;
                if (part.sessionID !== sessionId) {
                  continue;
                }

                if (part.type === "tool") {
                  const identifier = typeof part.callID === "string" ? part.callID : part.id;
                  if (identifier) {
                    streamedToolParts.set(identifier, part as ToolActivityPart);
                  }
                  continue;
                }

                if (part.type === "step-finish" && promptCompleted) {
                  break;
                }

                if (!shouldStream || (part.type !== "text" && part.type !== "reasoning")) {
                  continue;
                }

                await emitSnapshot(part.id, part.type, part.text);
                continue;
              }

              if (event.type === "message.part.delta") {
                if (!shouldStream) {
                  continue;
                }

                const properties = event.properties;
                if (properties.sessionID !== sessionId || properties.field !== "text") {
                  continue;
                }

                const partType = partTypes.get(properties.partID);
                if (!partType) {
                  continue;
                }

                const nextSnapshot = `${partSnapshots.get(properties.partID) ?? ""}${properties.delta}`;
                await emitSnapshot(properties.partID, partType, nextSnapshot);
              }
            }
          } finally {
            streamClosed = true;
            closeActiveEventStream = undefined;
            await events.stream.return?.(undefined);
          }
        })()
      : null;

    const result = await client.session.prompt({
      sessionID: sessionId,
      directory,
      model: {
        providerID: input.provider,
        modelID: input.model
      },
      variant: selectedVariant,
      system: toolUsageInstruction ? `${input.system}\n${toolUsageInstruction}` : input.system,
      format: input.schema
        ? {
            type: "json_schema",
            schema: zodToJsonSchema(input.schema, {
              target: "jsonSchema7",
              $refStrategy: "none"
            }),
            retryCount: input.retries ?? 1
          }
        : undefined,
      tools: input.enableWebSearch ? { websearch: true } : undefined,
      parts: [
        {
          type: "text",
          text: input.prompt
        }
      ]
    });

    if (result.error || !result.data) {
      const message = extractOpenCodeErrorMessage(result.error);
      throw new Error(message ? `OpenCode failed to generate a response: ${message}` : "OpenCode failed to generate a response");
    }

    promptCompleted = true;
    const drainResult = streamPromise
      ? await Promise.race<"drained" | "timeout">([
          streamPromise.then<"drained">(() => "drained").catch<"drained">(() => "drained"),
          new Promise((resolve) => {
            setTimeout(() => resolve("timeout"), STREAM_DRAIN_TIMEOUT_MS);
          })
        ])
      : "drained";

    if (drainResult === "timeout") {
      streamClosed = true;
      const closeEventStream = closeActiveEventStream;
      await closeEventStream?.().catch(() => undefined);
      await streamPromise?.catch(() => undefined);
    }

    if (result.data.info.error) {
      const error = result.data.info.error;
      const message = extractOpenCodeErrorMessage(error) ?? "OpenCode returned a generation error";
      throw new Error(message);
    }

    return {
      id: result.data.info.id,
      text: extractText(result.data.parts as Array<{ type: string; text?: string }>),
      structured: result.data.info.structured,
      usage: {
        ...normalizeUsage(result.data.info.tokens),
        ...extractActivityUsage([...streamedToolParts.values(), ...(Array.isArray(result.data.parts) ? result.data.parts : [])], mcpServerNames)
      }
    };
  } finally {
    streamClosed = true;
    const closeEventStream = closeActiveEventStream;
    await closeEventStream?.().catch(() => undefined);
    await streamPromise?.catch(() => undefined);
    await client.session.delete({ sessionID: sessionId, directory }).catch(() => undefined);
  }
}

export class OpenCodePillowCouncilProvider implements PillowCouncilProvider {
  async generateText(input: {
    provider: string;
    model: string;
    variant?: string;
    system: string;
    prompt: string;
    enableWebSearch?: boolean;
    temperature?: number;
    onTextDelta?: (delta: string, snapshot: string) => Promise<void> | void;
    onReasoningDelta?: (delta: string, snapshot: string) => Promise<void> | void;
  }): Promise<TextGenerationResult> {
    void input.temperature;

    const response = await promptOpenCode({
      provider: input.provider,
      model: input.model,
      variant: input.variant,
      system: input.system,
      prompt: input.prompt,
      enableWebSearch: input.enableWebSearch,
      onTextDelta: input.onTextDelta,
      onReasoningDelta: input.onReasoningDelta
    });

    return {
      id: response.id || createId("chat"),
      text: response.text,
      usage: response.usage
    };
  }

  async generateJson<T>(input: {
    provider: string;
    model: string;
    variant?: string;
    system: string;
    prompt: string;
    schema: z.ZodSchema<T>;
    enableWebSearch?: boolean;
    temperature?: number;
    retries?: number;
  }): Promise<{ data: T; raw: string; usage: ProviderUsage }> {
    void input.temperature;

    const response = await promptOpenCode({
      provider: input.provider,
      model: input.model,
      variant: input.variant,
      system: input.enableWebSearch ? input.system : `${input.system}\nReturn exactly one structured JSON object.`,
      prompt: input.prompt,
      enableWebSearch: input.enableWebSearch,
      schema: input.schema,
      retries: input.retries
    });

    if (response.structured === undefined) {
      throw new Error("OpenCode did not return structured output");
    }

    const parsed = input.schema.safeParse(response.structured);
    if (!parsed.success) {
      throw createStructuredOutputParseError(parsed.error);
    }

    return {
      data: parsed.data,
      raw: JSON.stringify(response.structured, null, 2),
      usage: response.usage
    };
  }
}

export class MockPillowCouncilProvider implements PillowCouncilProvider {
  async generateText(input: {
    provider: string;
    model: string;
    variant?: string;
    system: string;
    prompt: string;
    enableWebSearch?: boolean;
    temperature?: number;
    onTextDelta?: (delta: string, snapshot: string) => Promise<void> | void;
    onReasoningDelta?: (delta: string, snapshot: string) => Promise<void> | void;
  }): Promise<TextGenerationResult> {
    void input.provider;
    void input.model;
    void input.temperature;
    void input.variant;
    void input.enableWebSearch;

    const roleLine = input.system.split(".")[0] ?? "Agent";
    const title = input.prompt.split("\n")[0]?.replace(/^#\s*/, "") || "Topic";
    const text = `${roleLine}\n- Position: start with the smallest shippable scope for ${title}.\n- Reasoning: reduce implementation variance and validate the core decision loop first.\n- Recommendation: ship the critical path now and defer optional integrations.`;
    const reasoning = `Scan the current topic, identify the fastest validation loop, and expose the smallest useful response first. ${nowIso()}`;

    await input.onReasoningDelta?.(reasoning, reasoning);
    const midpoint = Math.ceil(text.length / 2);
    const firstChunk = text.slice(0, midpoint);
    const secondChunk = text.slice(midpoint);
    await input.onTextDelta?.(firstChunk, firstChunk);
    await input.onTextDelta?.(secondChunk, `${firstChunk}${secondChunk}`);

    return {
      id: createId("mock"),
      text,
      usage: {
        promptTokens: 100,
        completionTokens: 70,
        mcpCalls: 0,
        skillUses: 0,
        webSearches: 0
      }
    };
  }

  async generateJson<T>(input: {
    provider: string;
    model: string;
    variant?: string;
    system: string;
    prompt: string;
    schema: z.ZodSchema<T>;
    enableWebSearch?: boolean;
    temperature?: number;
    retries?: number;
  }): Promise<{ data: T; raw: string; usage: ProviderUsage }> {
    void input.provider;
    void input.model;
    void input.system;
    void input.prompt;
    void input.temperature;
    void input.variant;
    void input.enableWebSearch;
    void input.retries;

    const discussionMock = {
      keyPoints: [
        "Start by tightening the scope to the smallest useful workflow.",
        "Keep provider setup separate from session creation."
      ],
      agreements: ["The MVP should end with a concrete decision summary and TODO list."],
      disagreements: ["How much setup polish belongs in the first release."],
      risks: ["Provider credentials may be missing.", "Catalog loading can fail at runtime."],
      summary: "The panel aligns on shipping a narrow decision workflow with explicit saved connection settings.",
      topRecommendation: "Ship the separate connection settings flow first, then keep the session form focused on topic input.",
      alternatives: [
        "Keep provider selection inside every session form.",
        "Delay account auth and ship only API key auth."
      ],
      assumptions: [
        "This app is used locally or self-hosted by a single operator.",
        "Saved auth is handled by OpenCode outside the session form."
      ],
      openQuestions: [
        "Which providers should use browser login versus API key auth?",
        "How much provider-specific guidance belongs in the UI?"
      ],
      nextActions: [
        "Validate provider and model selection on session creation.",
        "Verify the runtime can read OpenCode credentials.",
        "Confirm decision export works after the OpenCode integration."
      ],
      finalSummary: "PillowCouncil should use OpenCode for provider discovery, auth, and model execution instead of custom provider glue.",
      todos: [
        {
          title: "Validate saved connection",
          description: "Confirm the saved provider, auth method, and model still exist in OpenCode before creating a session.",
          priority: "high",
          status: "pending"
        },
        {
          title: "Verify OpenCode auth bridge",
          description: "Ensure browser login and API key methods both show connected state correctly.",
          priority: "high",
          status: "pending"
        },
        {
          title: "Check export flow",
          description: "Confirm Markdown and JSON export still work after the OpenCode migration.",
          priority: "medium",
          status: "pending"
        }
      ]
    };

    const presetAgentCount = extractRequestedAgentCount(input.prompt);
    const presetMock = {
      name: "Custom Research Preset",
      description: "사용자 입력을 바탕으로 핵심 관점을 빠르게 정리하는 커스텀 프리셋",
      agents: Array.from({ length: presetAgentCount }, (_, index) => ({
        name: `Agent ${index + 1}`,
        role: index === presetAgentCount - 1 ? "회의론자" : `전문가 ${index + 1}`,
        goal: `관점 ${index + 1}에서 중요한 판단 기준을 드러낸다.`,
        bias: `관점 ${index + 1}에 유리한 신호를 우선해서 본다.`,
        style: `짧고 명확하게 핵심만 말한다 (${index + 1}).`,
        systemPrompt: `당신은 커스텀 프리셋의 에이전트 ${index + 1}다. 지정된 역할 관점에서 현실적인 의견을 제시한다.`
      }))
    };

    const candidates: unknown[] = [discussionMock, presetMock];
    const parsed = candidates
      .map((candidate) => input.schema.safeParse(candidate))
      .find((result) => result.success);

    if (!parsed?.success) {
      throw new Error("Mock provider could not satisfy the requested schema");
    }

    const data = parsed.data;
    return {
      data,
      raw: JSON.stringify(data, null, 2),
      usage: {
        promptTokens: 120,
        completionTokens: 90,
        mcpCalls: 0,
        skillUses: 0,
        webSearches: 0
      }
    };
  }
}

export function createPillowCouncilProvider(): PillowCouncilProvider {
  return new OpenCodePillowCouncilProvider();
}
