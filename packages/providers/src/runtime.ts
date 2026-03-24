import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2";

import { createId, getAppSettings, getDefaultAppSettings, nowIso, type ProviderAuthOption } from "@ship-council/shared";

import { getProviderOption, loadProviderCatalog } from "./catalog";
import { getOpencodeClient, getOpencodeDirectory } from "./opencode";

export type ProviderUsage = {
  promptTokens: number;
  completionTokens: number;
};

export type TextGenerationResult = {
  id: string;
  text: string;
  usage: ProviderUsage;
};

export interface CouncilProvider {
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
      completionTokens: 0
    };
  }

  const value = tokens as Record<string, unknown>;
  return {
    promptTokens: Number(value.input ?? 0),
    completionTokens: Number(value.output ?? 0)
  };
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
  await syncOpenCodeRuntimeSettings({ client, directory });
  const created = await client.session.create({
    directory,
    title: `Ship Council - ${provider.label}`
  });

  if (created.error || !created.data) {
    throw new Error("Failed to create an OpenCode session");
  }

  const sessionId = created.data.id;
  const shouldStream = Boolean(input.onTextDelta || input.onReasoningDelta);
  let streamClosed = false;
  let streamPromise: Promise<void> | null = null;

  try {
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

    streamPromise = shouldStream
      ? (async () => {
          const events = await client.event.subscribe({ directory });

          try {
            for await (const event of events.stream) {
              if (streamClosed) {
                break;
              }

              if (event.type === "message.part.updated") {
                const part = event.properties.part;
                if (part.sessionID !== sessionId || (part.type !== "text" && part.type !== "reasoning")) {
                  continue;
                }

                await emitSnapshot(part.id, part.type, part.text);
                continue;
              }

              if (event.type === "message.part.delta") {
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
      system: input.system,
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
      throw new Error("OpenCode failed to generate a response");
    }

    streamClosed = true;
    await streamPromise?.catch(() => undefined);

    if (result.data.info.error) {
      const error = result.data.info.error;
      const message =
        typeof error === "object" && error && "data" in error && typeof error.data === "object" && error.data && "message" in error.data
          ? String(error.data.message)
          : "OpenCode returned a generation error";
      throw new Error(message);
    }

    return {
      id: result.data.info.id,
      text: extractText(result.data.parts as Array<{ type: string; text?: string }>),
      structured: result.data.info.structured,
      usage: normalizeUsage(result.data.info.tokens)
    };
  } finally {
    streamClosed = true;
    await streamPromise?.catch(() => undefined);
    await client.session.delete({ sessionID: sessionId, directory }).catch(() => undefined);
  }
}

export class OpenCodeCouncilProvider implements CouncilProvider {
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
      system: input.enableWebSearch
        ? `${input.system}\nUse web search only when it materially improves accuracy.`
        : `${input.system}\nDo not use tools. Respond with plain text only.`,
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
      system: input.enableWebSearch
        ? `${input.system}\nUse web search only when it materially improves accuracy. Return exactly one structured JSON object.`
        : `${input.system}\nReturn exactly one structured JSON object.`,
      prompt: input.prompt,
      enableWebSearch: input.enableWebSearch,
      schema: input.schema,
      retries: input.retries
    });

    if (response.structured === undefined) {
      throw new Error("OpenCode did not return structured output");
    }

    const data = input.schema.parse(response.structured);

    return {
      data,
      raw: JSON.stringify(response.structured, null, 2),
      usage: response.usage
    };
  }
}

export class MockCouncilProvider implements CouncilProvider {
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
        completionTokens: 70
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
      finalSummary: "Ship Council should use OpenCode for provider discovery, auth, and model execution instead of custom provider glue.",
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
        completionTokens: 90
      }
    };
  }
}

export function createCouncilProvider(): CouncilProvider {
  return new OpenCodeCouncilProvider();
}
