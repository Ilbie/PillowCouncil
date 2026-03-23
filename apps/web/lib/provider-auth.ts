export type ProviderOauthPendingState = {
  providerId: string;
  authModeId: string;
  authorizationUrl: string;
  method: "auto" | "code";
  instructions: string;
  code: string;
  isSubmitting: boolean;
};

type AuthModeLike = {
  id: string;
  type: string;
};

type StartOauthResult = {
  authModeId: string;
  url: string;
  method: "auto" | "code";
  instructions: string;
};

type BeginProviderOauthFlowInput = {
  providerId: string;
  authModeId: string;
  startOauth: (providerId: string, authModeId: string) => Promise<StartOauthResult>;
  waitForCompletion?: () => Promise<void>;
};

type BeginProviderOauthFlowResult = {
  pendingOauth: ProviderOauthPendingState;
  completion: Promise<void> | null;
};

type WaitForOauthAutoCompletionInput = {
  isConnected: () => Promise<boolean>;
  pollIntervalMs: number;
  timeoutMs: number;
};

export async function beginProviderOauthFlow(
  input: BeginProviderOauthFlowInput
): Promise<BeginProviderOauthFlowResult> {
  const result = await input.startOauth(input.providerId, input.authModeId);
  const pendingOauth: ProviderOauthPendingState = {
    providerId: input.providerId,
    authModeId: result.authModeId,
    authorizationUrl: result.url,
    method: result.method,
    instructions: result.instructions,
    code: "",
    isSubmitting: false
  };
  const completion =
    pendingOauth.method === "auto" && input.waitForCompletion ? input.waitForCompletion() : null;

  return {
    pendingOauth,
    completion
  };
}

export async function waitForOauthAutoCompletion({
  isConnected,
  pollIntervalMs,
  timeoutMs
}: WaitForOauthAutoCompletionInput): Promise<void> {
  return new Promise((resolve, reject) => {
    let isComplete = false;
    let intervalId: ReturnType<typeof setInterval> | number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | number | null = null;

    const cleanup = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };

    const stop = (error?: Error) => {
      if (isComplete) {
        return;
      }

      isComplete = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const check = async () => {
      try {
        const connected = await isConnected();
        if (connected) {
          stop();
        }
      } catch (error) {
        stop(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void check();

    intervalId = setInterval(() => {
      void check();
    }, pollIntervalMs);

    timeoutId = setTimeout(() => {
      stop(new Error("OAuth login did not complete before timeout."));
    }, timeoutMs);
  });
}

export function pickPreferredAuthModeId(
  authModes: readonly AuthModeLike[],
  currentAuthModeId?: string
): string {
  const explicitMatch = authModes.find((item) => item.id === currentAuthModeId)?.id;
  if (explicitMatch) {
    return explicitMatch;
  }

  return authModes[0]?.id ?? "";
}
