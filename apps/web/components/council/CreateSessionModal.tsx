import type { ChangeEvent, FC } from "react";
import { CheckCircle2, ChevronDown, Lightbulb, X } from "lucide-react";

import type { ProviderConnectionState } from "@ship-council/providers";
import type { PresetDefinition, ProviderOption, SessionLanguage } from "@ship-council/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clampDebateIntensity } from "@/lib/council-app-helpers";
import {
  getCloseLabel,
  getOpenPresetStudioLabel,
  getPresetStudioShortcutDescription,
  getSessionModelHint,
  getSessionModelLabel,
  getSessionSectionDescription,
  getStructuredOutputReadyLabel,
  getThinkingFieldHint,
  getThinkingFieldLabel
} from "@/lib/council-app-labels";
import type { SessionFormState } from "@/lib/council-app-types";
import { type UiLocale, getUiCopy } from "@/lib/i18n";

type Option = { value: string; label: string; description: string };

type CreateSessionModalProps = {
  copy: ReturnType<typeof getUiCopy>;
  uiLocale: UiLocale;
  isOpen: boolean;
  form: SessionFormState;
  availablePresets: PresetDefinition[];
  activePreset: PresetDefinition | null | undefined;
  generatedPreset: PresetDefinition | null;
  savedProvider: ProviderOption | null | undefined;
  savedAuthOption: ProviderOption["authModes"][number] | null | undefined;
  savedConnectionState: ProviderConnectionState;
  selectedLanguage: { value: SessionLanguage; label: string; description: string };
  selectedDebateIntensityLabel: string;
  selectedDebateIntensityDescription: string;
  selectedThinkingIntensityLabel: string;
  selectedThinkingIntensityDescription: string;
  sessionProvider: ProviderOption | null | undefined;
  sessionModel: ProviderOption["models"][number] | null | undefined;
  sessionModelOptions: ProviderOption["models"];
  sessionLanguageOptions: Array<{ value: SessionLanguage; label: string; description: string }>;
  thinkingOptions: Option[];
  isConnectionDirty: boolean;
  isRefreshingModels: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onOpenPresetStudio: () => void;
  onCreate: () => void;
  onFormChange: (patch: Partial<SessionFormState>) => void;
};

export const CreateSessionModal: FC<CreateSessionModalProps> = ({
  copy,
  uiLocale,
  isOpen,
  form,
  availablePresets,
  activePreset,
  generatedPreset,
  savedProvider,
  savedAuthOption,
  savedConnectionState,
  selectedLanguage,
  selectedDebateIntensityLabel,
  selectedDebateIntensityDescription,
  selectedThinkingIntensityLabel,
  selectedThinkingIntensityDescription,
  sessionProvider,
  sessionModel,
  sessionModelOptions,
  sessionLanguageOptions,
  thinkingOptions,
  isConnectionDirty,
  isRefreshingModels,
  isSubmitting,
  onClose,
  onOpenPresetStudio,
  onCreate,
  onFormChange
}) => {
  if (!isOpen) {
    return null;
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="create-session-dialog-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-gray-800 bg-[#060913] shadow-[0_24px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-gray-800 bg-[#090d1a] px-6 py-4">
          <h2 id="create-session-dialog-title" className="text-lg font-bold text-gray-100">{copy.session.title}</h2>
          <button aria-label={getCloseLabel(uiLocale)} className="text-gray-400 hover:text-white" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="council-scrollbar flex-1 overflow-y-auto p-6">
          <div>
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-200">
                <Lightbulb size={16} className="text-blue-400" />
                {copy.session.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">{getSessionSectionDescription(uiLocale)}</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-[20px] border border-gray-800 bg-gray-900/70 p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{copy.session.activeConnection}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{savedProvider?.label ?? copy.session.providerNotSaved}</Badge>
                  <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{savedAuthOption?.label ?? copy.session.loginNotSaved}</Badge>
                  <Badge className={savedConnectionState.connected ? "border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400" : "border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-400"}>
                    {savedConnectionState.connected ? copy.connection.connected : copy.connection.notConnected}
                  </Badge>
                  <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{selectedLanguage.label}</Badge>
                  <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{sessionModel?.label ?? copy.session.modelNotSaved}</Badge>
                  <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{selectedDebateIntensityLabel}</Badge>
                  <Badge className="border-gray-700 bg-gray-800/90 text-gray-300">{selectedThinkingIntensityLabel}</Badge>
                </div>
                {!savedConnectionState.connected ? <p className="mt-3 text-xs leading-5 text-gray-500">{copy.session.connectHint}</p> : null}
                {isConnectionDirty ? <p className="mt-3 text-xs leading-5 text-gray-500">{copy.session.dirtyHint}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{copy.session.titleLabel}</label>
                <Input className="h-12 rounded-[18px] border-gray-800 bg-gray-900/80 text-sm text-gray-100 placeholder:text-gray-500" value={form.title} onChange={(event: ChangeEvent<HTMLInputElement>) => onFormChange({ title: event.target.value })} placeholder={copy.session.titlePlaceholder} />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{copy.session.topicLabel}</label>
                <Textarea className="min-h-[112px] rounded-[20px] border-gray-800 bg-gray-900/80 text-sm text-gray-100 placeholder:text-gray-500" value={form.prompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onFormChange({ prompt: event.target.value })} placeholder={copy.session.topicPlaceholder} />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{copy.session.presetLabel}</label>
                <div className="relative">
                  <Select className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100" value={form.presetId} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFormChange({ presetId: event.target.value })}>
                    {availablePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                  </Select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
                <p className="text-xs leading-5 text-gray-500">{getPresetStudioShortcutDescription(uiLocale)}</p>
              </div>



              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{getSessionModelLabel(uiLocale)}</label>
                    {isRefreshingModels ? <span className="text-[11px] text-gray-500">{copy.refreshing}</span> : null}
                  </div>
                  <div className="relative">
                    <Select className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100" value={form.model} disabled={!sessionProvider || sessionModelOptions.length === 0} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFormChange({ model: event.target.value })}>
                      {sessionModelOptions.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                    </Select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  </div>
                  <p className="text-xs leading-5 text-gray-500">{sessionModel?.description ?? getSessionModelHint(uiLocale)}</p>
                  {sessionModel?.supportsStructuredOutput ? (
                    <p className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <CheckCircle2 size={12} />
                      {getStructuredOutputReadyLabel(uiLocale)}
                    </p>
                  ) : null}
                  {sessionModel?.supportsWebSearch ? (
                    <label className="mt-3 flex items-start gap-3 rounded-[18px] border border-gray-800 bg-gray-950/60 px-4 py-3 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500"
                        checked={form.enableWebSearch}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => onFormChange({ enableWebSearch: event.target.checked })}
                      />
                      <span className="space-y-1">
                        <span className="block font-medium text-gray-100">{copy.session.webSearchLabel}</span>
                        <span className="block text-xs leading-5 text-gray-500">{copy.session.webSearchHint}</span>
                      </span>
                    </label>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{copy.session.languageLabel}</label>
                  <div className="relative">
                    <Select className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100" value={form.language} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFormChange({ language: event.target.value as SessionLanguage })}>
                      {sessionLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  </div>
                  <p className="text-xs leading-5 text-gray-500">{selectedLanguage.description}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{copy.session.debateIntensityLabel}</label>
                <Input
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    className="h-12 rounded-[18px] border-gray-800 bg-gray-900/80 text-sm text-gray-100"
                    value={form.debateIntensity}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      const val = event.target.value;
                      onFormChange({ debateIntensity: val === "" ? clampDebateIntensity(NaN) : clampDebateIntensity(Number(val)) });
                    }}
                  />
                  <p className="text-xs leading-5 text-gray-500">{copy.session.debateIntensityHint} {selectedDebateIntensityDescription}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">{getThinkingFieldLabel(uiLocale)}</label>
                  <div className="relative">
                    <Select className="h-12 appearance-none rounded-[18px] border-gray-800 bg-gray-900/80 px-4 pr-10 text-sm text-gray-100" value={form.thinkingIntensity} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFormChange({ thinkingIntensity: event.target.value })}>
                      {thinkingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  </div>
                  <p className="text-xs leading-5 text-gray-500">{getThinkingFieldHint(uiLocale)} {selectedThinkingIntensityDescription}</p>
                </div>
              </div>

              <Button className="h-12 w-full rounded-xl bg-blue-600 text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)] hover:bg-blue-500" onClick={onCreate} disabled={isSubmitting || form.prompt.trim().length < 10 || !savedConnectionState.connected || isConnectionDirty || !form.model}>
                {isSubmitting ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                {copy.session.create}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-gray-800 bg-[#090d1a] px-6 py-4">
          <Button variant="secondary" className="bg-gray-800 text-white hover:bg-gray-700" onClick={onClose}>
            {getCloseLabel(uiLocale)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateSessionModal;
