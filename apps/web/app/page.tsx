import { PRESET_DEFINITIONS } from "@ship-council/agents";
import { getDefaultAuthModeId, getDefaultModelId, getDefaultProviderId, getProviderConnectionState, loadProviderCatalog } from "@ship-council/providers";
import { getAppSettings, listSessions } from "@ship-council/shared";

import { CouncilApp } from "@/components/council-app";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessions = listSessions();
  const providerOptions = await loadProviderCatalog().catch(() => []);
  const defaultProvider = getDefaultProviderId(providerOptions);
  const defaultModel = getDefaultModelId(defaultProvider, providerOptions);
  const defaultAuthMode = getDefaultAuthModeId(defaultProvider, providerOptions);
  const settings = getAppSettings();
  const initialConnection = await getProviderConnectionState(settings.providerId, settings.authMode).catch(() => ({
    providerId: settings.providerId,
    authModeId: settings.authMode,
    connected: false,
    available: false
  }));

  return (
    <CouncilApp
      initialPresets={PRESET_DEFINITIONS}
      initialSessions={sessions}
      initialSettings={settings}
      providerOptions={providerOptions}
      defaultProvider={defaultProvider}
      defaultModel={defaultModel}
      defaultAuthMode={defaultAuthMode}
      initialConnection={initialConnection}
    />
  );
}
