import type { ProviderAuthAuthorization, ProviderAuthMethod } from "@opencode-ai/sdk/v2";

import { invalidateProviderCatalog, loadProviderCatalog, parseAuthModeId } from "./catalog";
import { getOpencodeClient, getOpencodeDirectory } from "./opencode";

export type ProviderOauthModeResolution = {
  authModeId: string;
  methodIndex: number;
};

export type StartProviderOauthResult = {
  authModeId: string;
  authorization: ProviderAuthAuthorization;
};

export type ProviderConnectionState = {
  providerId: string;
  authModeId: string;
  connected: boolean;
  available: boolean;
};

function extractOpencodeErrorMessage(error: unknown, depth = 0): string {
  const extracted = resolveOpencodeErrorMessage(error, depth);
  if (extracted) {
    return extracted;
  }

  if (error && typeof error === "object") {
    try {
      return `unknown error: ${JSON.stringify(error)}`;
    } catch {
      return "unknown error";
    }
  }

  return "unknown error";
}

function resolveOpencodeErrorMessage(error: unknown, depth = 0): string | undefined {
  if (depth > 5) {
    return undefined;
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    return message || undefined;
  }

  if (typeof error === "string") {
    const message = error.trim();
    return message || undefined;
  }

  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }

  if (!error || typeof error !== "object") {
    return undefined;
  }

  if (Array.isArray(error)) {
    for (const entry of error) {
      const message = resolveOpencodeErrorMessage(entry, depth + 1);
      if (message) {
        return message;
      }
    }
    return undefined;
  }

  const errorObject = error as Record<string, unknown>;

  const messageCandidates = [
    errorObject.message,
    errorObject.error_description,
    errorObject.msg,
    errorObject.error,
    errorObject.detail,
    errorObject.reason,
    errorObject.data,
    errorObject.name,
    errorObject.errors
  ];

  for (const candidate of messageCandidates) {
    const message = resolveOpencodeErrorMessage(candidate, depth + 1);
    if (message) {
      return message;
    }
  }

  return undefined;
}

function getMethodIndex(authModeId: string, expectedType: "api" | "oauth"): number {
  const parsed = parseAuthModeId(authModeId);
  if (!parsed || parsed.type !== expectedType) {
    throw new Error(`Unsupported auth mode: ${authModeId}`);
  }

  return parsed.methodIndex;
}

export function resolveProviderOauthMode(
  authModeId: string | undefined,
  authMethods: ProviderAuthMethod[]
): ProviderOauthModeResolution {
  const parsed = authModeId ? parseAuthModeId(authModeId) : null;
  if (parsed && parsed.type === "oauth" && authMethods[parsed.methodIndex]?.type === "oauth") {
    return {
      authModeId: `oauth:${parsed.methodIndex}`,
      methodIndex: parsed.methodIndex
    };
  }

  const firstOauthMethodIndex = authMethods.findIndex((method) => method.type === "oauth");
  if (firstOauthMethodIndex === -1) {
    throw new Error("Selected provider does not support browser login");
  }

  return {
    authModeId: `oauth:${firstOauthMethodIndex}`,
    methodIndex: firstOauthMethodIndex
  };
}

async function loadProviderAuthMethods(providerId: string): Promise<ProviderAuthMethod[]> {
  const client = await getOpencodeClient();
  const directory = getOpencodeDirectory();
  const result = await client.provider.auth({ directory });

  if (result.error || !result.data) {
    throw new Error("Failed to load provider auth methods");
  }

  return result.data[providerId] ?? [];
}

export async function saveApiKeyAuth(providerId: string, authModeId: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return;
  }

  getMethodIndex(authModeId, "api");
  const client = await getOpencodeClient();
  const result = await client.auth.set({
    providerID: providerId,
    auth: {
      type: "api",
      key: trimmed
    }
  });

  if (result.error) {
    throw new Error("Failed to save API key into OpenCode");
  }

  invalidateProviderCatalog();
}

export async function disconnectProviderAuth(providerId: string): Promise<void> {
  const client = await getOpencodeClient();
  const result = await client.auth.remove({ providerID: providerId });

  if (result.error) {
    throw new Error("Failed to remove OpenCode credentials");
  }

  invalidateProviderCatalog();
}

export async function startProviderOauth(providerId: string, authModeId?: string): Promise<StartProviderOauthResult> {
  const authMethods = await loadProviderAuthMethods(providerId);
  const resolvedMode = resolveProviderOauthMode(authModeId, authMethods);
  const client = await getOpencodeClient();
  const directory = getOpencodeDirectory();
  const result = await client.provider.oauth.authorize({
    providerID: providerId,
    directory,
    method: resolvedMode.methodIndex
  });

  if (result.error) {
    const message = extractOpencodeErrorMessage(result.error);
    throw new Error(`Failed to start OpenCode login: ${message}`);
  }

  if (!result.data || !result.data.url || !result.data.method || !result.data.instructions) {
    throw new Error("Failed to start OpenCode login: OpenCode returned incomplete authorization payload");
  }

  return {
    authModeId: resolvedMode.authModeId,
    authorization: result.data
  };
}

export async function completeProviderOauth(providerId: string, authModeId: string | undefined, code?: string): Promise<void> {
  const authMethods = await loadProviderAuthMethods(providerId);
  const resolvedMode = resolveProviderOauthMode(authModeId, authMethods);
  const client = await getOpencodeClient();
  const directory = getOpencodeDirectory();
  const result = await client.provider.oauth.callback({
    providerID: providerId,
    directory,
    method: resolvedMode.methodIndex,
    code
  });

  if (result.error) {
    const message = extractOpencodeErrorMessage(result.error);
    throw new Error(`Failed to complete OpenCode login: ${message}`);
  }

  invalidateProviderCatalog();
}

export async function getProviderConnection(providerId: string): Promise<{ providerId: string; connected: boolean }> {
  const catalog = await loadProviderCatalog({ force: true });
  const provider = catalog.find((item) => item.id === providerId);

  return {
    providerId,
    connected: provider?.connected ?? false
  };
}

export async function getProviderConnectionState(providerId: string, authModeId: string): Promise<ProviderConnectionState> {
  const catalog = await loadProviderCatalog({ force: true });
  const provider = catalog.find((item) => item.id === providerId);
  const available = provider?.authModes.some((item) => item.id === authModeId) ?? false;

  return {
    providerId,
    authModeId,
    connected: provider?.connected ?? false,
    available
  };
}

export async function listProviderConnections(): Promise<Array<{ providerId: string; connected: boolean }>> {
  const catalog = await loadProviderCatalog({ force: true });
  return catalog.map((provider) => ({
    providerId: provider.id,
    connected: provider.connected
  }));
}
