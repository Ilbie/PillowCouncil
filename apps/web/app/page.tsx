import { PRESET_DEFINITIONS } from "@pillow-council/agents";
import { countSessions, getAppSettings, listSavedPresets, listSessions } from "@pillow-council/shared";

import { PillowCouncilApp } from "@/components/council-app";
import { SESSION_HISTORY_PAGE_SIZE } from "@/lib/council-app-types";
import { mergePersistedPresets } from "@/lib/council-app-helpers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = getAppSettings();
  const sessions = listSessions({ limit: SESSION_HISTORY_PAGE_SIZE, offset: 0 });
  const totalSessionCount = countSessions();
  const savedPresets = listSavedPresets();
  const initialPresets = mergePersistedPresets(PRESET_DEFINITIONS, savedPresets);
  const initialConnection = {
    providerId: settings.providerId,
    authModeId: settings.authMode,
    connected: false,
    available: false
  };

  return (
    <PillowCouncilApp
      initialPresets={initialPresets}
      initialSessions={sessions}
      initialTotalSessionCount={totalSessionCount}
      initialSettings={settings}
      providerOptions={[]}
      defaultProvider={settings.providerId}
      defaultModel={settings.modelId}
      defaultAuthMode={settings.authMode}
      initialConnection={initialConnection}
    />
  );
}
