import type { ProviderAuthMethod } from "@opencode-ai/sdk/v2";
import type {
  ProviderAuthOption,
  ProviderModelOption,
  ProviderModelVariantOption,
  ProviderOption as PillowCouncilProviderOption
} from "@pillow-council/shared";

import { getOpencodeClient, getOpencodeDirectory } from "./opencode";

const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

type OpenCodeModel = {
  id: string;
  name: string;
  release_date: string;
  attachment: boolean;
  reasoning: boolean;
  toolcall?: boolean;
  tool_call?: boolean;
  limit: {
    context: number;
    input?: number;
    output: number;
  };
  input?: {
    text: boolean;
    audio: boolean;
    image: boolean;
    video: boolean;
    pdf: boolean;
  };
  output?: {
    text: boolean;
    audio: boolean;
    image: boolean;
    video: boolean;
    pdf: boolean;
  };
  modalities?: {
    input: Array<"text" | "audio" | "image" | "video" | "pdf">;
    output: Array<"text" | "audio" | "image" | "video" | "pdf">;
  };
  status?: "alpha" | "beta" | "deprecated" | "active";
  options?: Record<string, unknown>;
  headers?: Record<string, string>;
  variants?: Record<string, Record<string, unknown>>;
};

type OpenCodeProvider = {
  api?: string;
  name: string;
  env: string[];
  id: string;
  npm?: string;
  models: Record<string, OpenCodeModel>;
};

let catalogCache: { data: PillowCouncilProviderOption[]; expiresAt: number } | null = null;

function toTitleCase(value: string): string {
  return value
    .split(/[-_/ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function createAuthModeId(type: ProviderAuthOption["type"], methodIndex: number): string {
  return `${type}:${methodIndex}`;
}

function createVariantLabel(value: string): string {
  return value
    .split(/[-_/ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toVariantOption(variantId: string, variant: Record<string, unknown>): ProviderModelVariantOption | null {
  if (variant.disabled === true) {
    return null;
  }

  const label = createVariantLabel(variantId);
  const reasoningEffort = typeof variant.reasoningEffort === "string" ? variant.reasoningEffort : null;
  const descriptionParts = [
    reasoningEffort ? `reasoning effort: ${reasoningEffort}` : null,
    typeof variant.textVerbosity === "string" ? `text verbosity: ${variant.textVerbosity}` : null,
    typeof variant.reasoningSummary === "string" ? `reasoning summary: ${variant.reasoningSummary}` : null
  ].filter((value): value is string => value !== null);

  return {
    id: variantId,
    label,
    description: descriptionParts.join(" · ") || `Use the ${label} preset for this model.`,
    reasoningEffort
  };
}

function getModelVariants(model: OpenCodeModel): ProviderModelVariantOption[] {
  return Object.entries(model.variants ?? {})
    .map(([variantId, variant]) => toVariantOption(variantId, variant))
    .filter((variant): variant is ProviderModelVariantOption => variant !== null);
}

export function parseAuthModeId(value: string): { type: ProviderAuthOption["type"]; methodIndex: number } | null {
  const match = /^(api|oauth):(\d+)$/.exec(value.trim());
  if (!match) {
    return null;
  }

  return {
    type: match[1] as ProviderAuthOption["type"],
    methodIndex: Number(match[2])
  };
}

function isConversationModel(providerId: string, modelId: string, model: OpenCodeModel): boolean {
  const outputModalities =
    model.modalities?.output?.map((value) => value.toLowerCase()) ??
    Object.entries(model.output ?? {})
      .filter(([, enabled]) => enabled)
      .map(([key]) => key.toLowerCase());
  const fingerprint = [providerId, modelId, model.name ?? ""].join(" ").toLowerCase();

  if (/(embedding|rerank|moderation|transcription|speech|tts|stt|image|video|vision|audio-generator)/.test(fingerprint)) {
    return false;
  }

  if (outputModalities.length > 0 && !outputModalities.includes("text")) {
    return false;
  }

  return model.status !== "deprecated";
}

function scoreModel(model: ProviderModelOption): number {
  return (
    (model.supportsStructuredOutput ? 10_000 : 0) +
    (model.supportsToolCall ? 1_000 : 0) +
    (model.supportsReasoning ? 100 : 0) +
    Math.min(model.contextWindow ?? 0, 99)
  );
}

function inferWebSearchSupport(providerId: string, modelId: string, model: OpenCodeModel): boolean {
  if (model.toolcall ?? model.tool_call) {
    return true;
  }

  const fingerprint = `${providerId} ${modelId} ${model.name ?? ""}`.toLowerCase();

  if (providerId === "openai" && /\bgpt-5([-. ]|$)/.test(fingerprint)) {
    return true;
  }

  return false;
}

function toModelOption(providerId: string, modelId: string, model: OpenCodeModel): ProviderModelOption | null {
  if (!isConversationModel(providerId, modelId, model)) {
    return null;
  }

  const supportsWebSearch = inferWebSearchSupport(providerId, modelId, model);
  const capabilities = [
    model.toolcall ?? model.tool_call ? "tool calling" : null,
    supportsWebSearch ? "web search" : null,
    model.reasoning ? "reasoning" : null,
    "structured output"
  ].filter((value): value is string => value !== null);
  const variants = getModelVariants(model);

  return {
    id: model.id?.trim() || modelId,
    label: model.name?.trim() || modelId,
    description: capabilities.join(", "),
    family: model.id?.split("-").slice(0, 2).join("-"),
    contextWindow: model.limit?.context ?? null,
    supportsReasoning: Boolean(model.reasoning),
    supportsToolCall: Boolean(model.toolcall ?? model.tool_call),
    supportsWebSearch,
    supportsStructuredOutput: true,
    variants
  };
}

function toAuthOption(method: ProviderAuthMethod, methodIndex: number, envKeys: string[]): ProviderAuthOption {
  return {
    id: createAuthModeId(method.type, methodIndex),
    type: method.type,
    methodIndex,
    label: method.label,
    description:
      method.type === "api"
        ? "Save this API key into the OpenCode credential store."
        : "Use the OpenCode browser login flow for this provider.",
    envKeys: method.type === "api" ? envKeys : [],
    inputLabel: method.type === "api" ? "API Key" : null,
    inputPlaceholder: method.type === "api" ? (envKeys[0] ?? "sk-...") : null,
    flowKind: method.type === "api" ? "manual" : "oauth"
  };
}

export function buildProviderAuthOptions(
  authMethods: ProviderAuthMethod[],
  envKeys: string[]
): ProviderAuthOption[] {
  const supportedMethods = authMethods;

  return supportedMethods.map((method) => {
    const methodIndex = authMethods.indexOf(method);
    return toAuthOption(method, methodIndex, envKeys);
  });
}

function toProviderOption(input: {
  provider: OpenCodeProvider;
  authMethods: ProviderAuthMethod[];
  connectedProviders: Set<string>;
}): PillowCouncilProviderOption | null {
  const models = Object.entries(input.provider.models ?? {})
    .map(([modelId, model]) => toModelOption(input.provider.id, modelId, model))
    .filter((model): model is ProviderModelOption => model !== null)
    .sort((left, right) => scoreModel(right) - scoreModel(left) || left.label.localeCompare(right.label));

  if (models.length === 0) {
    return null;
  }

  const envKeys = Array.isArray(input.provider.env) ? input.provider.env : [];
  const authModes = buildProviderAuthOptions(input.authMethods, envKeys);

  return {
    id: input.provider.id,
    label: input.provider.name || toTitleCase(input.provider.id),
    description: `Loaded from OpenCode provider registry${input.connectedProviders.has(input.provider.id) ? " (connected)" : ""}.`,
    npmPackage: input.provider.npm ?? "opencode-ai",
    apiBaseUrl: input.provider.api ?? null,
    docUrl: "https://opencode.ai/docs/providers",
    connected: input.connectedProviders.has(input.provider.id),
    authModes,
    models
  };
}

export function invalidateProviderCatalog(): void {
  catalogCache = null;
}

export async function loadProviderCatalog(options?: { force?: boolean }): Promise<PillowCouncilProviderOption[]> {
  if (!options?.force && catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.data;
  }

  const client = await getOpencodeClient();
  const directory = getOpencodeDirectory();
  const [providersResult, authResult] = await Promise.all([
    client.provider.list({ directory }),
    client.provider.auth({ directory })
  ]);

  if (providersResult.error || !providersResult.data) {
    const message =
      typeof providersResult.error === "object" &&
      providersResult.error &&
      "message" in providersResult.error &&
      typeof providersResult.error.message === "string"
        ? providersResult.error.message
        : "unknown error";
    throw new Error(`Failed to load OpenCode providers: ${message}`);
  }

  if (authResult.error || !authResult.data) {
    const message =
      typeof authResult.error === "object" && authResult.error && "message" in authResult.error && typeof authResult.error.message === "string"
        ? authResult.error.message
        : "unknown error";
    throw new Error(`Failed to load OpenCode auth methods: ${message}`);
  }

  const connectedProviders = new Set(providersResult.data.connected);
  const authMethodsByProvider = authResult.data;

  const catalog = providersResult.data.all
    .map((provider) =>
      toProviderOption({
        provider,
        authMethods: authMethodsByProvider[provider.id] ?? [],
        connectedProviders
      })
    )
    .filter((provider): provider is PillowCouncilProviderOption => provider !== null)
    .sort((left, right) => left.label.localeCompare(right.label));

  catalogCache = {
    data: catalog,
    expiresAt: Date.now() + CATALOG_CACHE_TTL_MS
  };

  return catalog;
}

export function getProviderOption(
  providerId: string,
  options: PillowCouncilProviderOption[] = []
): PillowCouncilProviderOption | undefined {
  return options.find((provider) => provider.id === providerId);
}

export function getDefaultProviderId(options: PillowCouncilProviderOption[] = []): string {
  return options[0]?.id ?? "";
}

export function getDefaultModelId(providerId: string, options: PillowCouncilProviderOption[] = []): string {
  const provider = getProviderOption(providerId, options) ?? options[0];

  return provider?.models[0]?.id ?? "";
}

export function getDefaultAuthModeId(providerId: string, options: PillowCouncilProviderOption[] = []): string {
  const provider = getProviderOption(providerId, options) ?? options[0];
  return provider?.authModes[0]?.id ?? "";
}
