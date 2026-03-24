import { type ChangeEvent, type FC, useState } from "react";
import { CheckCircle2, ChevronDown, Cpu, LoaderCircle, Lock, LogIn, Plus, Settings2, Sparkles, Trash2, X } from "lucide-react";

import type { ProviderConnectionState } from "@ship-council/providers";
import type { AppSettings, PresetDefinition, ProviderOption, SessionLanguage } from "@ship-council/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clampAgentCount, type ConnectionDraft } from "@/lib/council-app-helpers";
import {
  getCloseLabel,
  getReturnToSessionLabel
} from "@/lib/council-app-labels";
import type { McpSettingsDraft, PendingOauthState, SessionFormState, SettingsTab, SkillsSettingsDraft } from "@/lib/council-app-types";
import { formatUiTimestamp, type UiLocale, getUiCopy } from "@/lib/i18n";

type Option = { value: string; label: string; description: string };

type SettingsModalProps = {
  copy: ReturnType<typeof getUiCopy>;
  uiLocale: UiLocale;
  isOpen: boolean;
  settingsTab: SettingsTab;
  shouldReturnToSession: boolean;
  providerOptions: ProviderOption[];
  connectionDraft: ConnectionDraft;
  connectionProvider: ProviderOption | null | undefined;
  connectionAuthOption: ProviderOption["authModes"][number] | null | undefined;
  hasProviders: boolean;
  isProviderConnected: boolean;
  isSavingConnection: boolean;
  isSavingMcpSettings: boolean;
  isSavingSkillsSettings: boolean;
  isSettingsConnectionSaved: boolean;
  isPresetTabLocked: boolean;
  isRefreshingModels: boolean;
  isGeneratingPreset: boolean;
  isPresetGenerationSuccess: boolean;
  isConnectionDirty: boolean;
  pendingOauth: PendingOauthState | null;
  savedSettings: AppSettings;
  mcpSettings: McpSettingsDraft;
  skillsSettings: SkillsSettingsDraft;
  savedConnectionState: ProviderConnectionState;
  sessionProvider: ProviderOption | null | undefined;
  sessionModelOptions: ProviderOption["models"];
  sessionLanguageOptions: Array<{ value: SessionLanguage; label: string; description: string }>;
  thinkingOptions: Option[];
  selectedLanguage: { value: SessionLanguage; label: string; description: string };
  form: SessionFormState;
  generatedPresetPrompt: string;
  generatedPresetAgentCount: number;
  generatedPreset?: PresetDefinition | null;
  onClose: () => void;
  onReturnToSession: () => void;
  onSwitchTab: (tab: SettingsTab) => void;
  onConnectionProviderChange: (providerId: string) => void;
  onConnectionAuthModeChange: (authMode: string) => void;
  onConnectionApiKeyChange: (apiKey: string) => void;
  onPendingOauthCodeChange: (code: string) => void;
  onSaveConnection: () => void;
  onOpenLogin: () => void;
  onCompleteOauth: () => void;
  onDisconnectAuth: () => void;
  onMcpSettingsChange: (next: McpSettingsDraft) => void;
  onSaveMcpSettings: () => void;
  onSkillsSettingsChange: (next: SkillsSettingsDraft) => void;
  onSaveSkillsSettings: () => void;
  onFormChange: (patch: Partial<SessionFormState>) => void;
  onGeneratedPresetPromptChange: (prompt: string) => void;
  onGeneratedPresetAgentCountChange: (count: number) => void;
  onGeneratePreset: () => void;
};

export const SettingsModal: FC<SettingsModalProps> = ({
  copy,
  uiLocale,
  isOpen,
  settingsTab,
  shouldReturnToSession,
  providerOptions,
  connectionDraft,
  connectionProvider,
  connectionAuthOption,
  hasProviders,
  isProviderConnected,
  isSavingConnection,
  isSavingMcpSettings,
  isSavingSkillsSettings,
  isSettingsConnectionSaved,
  isPresetTabLocked,
  isRefreshingModels,
  isGeneratingPreset,
  isPresetGenerationSuccess,
  isConnectionDirty,
  pendingOauth,
  savedSettings,
  mcpSettings,
  skillsSettings,
  savedConnectionState,
  sessionProvider,
  sessionModelOptions,
  sessionLanguageOptions,
  thinkingOptions,
  selectedLanguage,
  form,
  generatedPresetPrompt,
  generatedPresetAgentCount,
  onClose,
  onReturnToSession,
  onSwitchTab,
  onConnectionProviderChange,
  onConnectionAuthModeChange,
  onConnectionApiKeyChange,
  onPendingOauthCodeChange,
  onSaveConnection,
  onOpenLogin,
  onCompleteOauth,
  onDisconnectAuth,
  onMcpSettingsChange,
  onSaveMcpSettings,
  onSkillsSettingsChange,
  onSaveSkillsSettings,
  onFormChange,
  onGeneratedPresetPromptChange,
  onGeneratedPresetAgentCountChange,
  onGeneratePreset
}) => {
  const [newMcpName, setNewMcpName] = useState("");
  const [newMcpType, setNewMcpType] = useState<"local" | "remote">("local");
  const [newMcpTarget, setNewMcpTarget] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDescription, setNewSkillDescription] = useState("");
  const [newSkillContent, setNewSkillContent] = useState("");

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6">
      <div className="flex h-[85vh] max-h-[800px] w-full max-w-5xl overflow-hidden rounded-[24px] border border-gray-800 bg-[#0b0f19] shadow-2xl animate-in zoom-in-95 duration-200">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-800 bg-[#121826] md:flex">
          <div className="p-6">
            <h2 className="text-lg font-bold text-white">설정</h2>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            <div className="mb-2 mt-2 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">워크스페이스</span>
            </div>

            <button
              type="button"
              onClick={() => onSwitchTab("connection")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${settingsTab === "connection" ? "bg-blue-600/10 text-blue-400" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"}`}
            >
              <Settings2 size={18} className={settingsTab === "connection" ? "text-blue-400" : "text-gray-500"} />
              연결 설정
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab("preset")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${settingsTab === "preset" ? "bg-blue-600/10 text-blue-400" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"}`}
            >
              <Cpu size={18} className={settingsTab === "preset" ? "text-blue-400" : "text-gray-500"} />
              프리셋 스튜디오
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab("mcp")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${settingsTab === "mcp" ? "bg-blue-600/10 text-blue-400" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"}`}
            >
              <Sparkles size={18} className={settingsTab === "mcp" ? "text-blue-400" : "text-gray-500"} />
              MCP 설정
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab("skills")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${settingsTab === "skills" ? "bg-blue-600/10 text-blue-400" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"}`}
            >
              <Sparkles size={18} className={settingsTab === "skills" ? "text-blue-400" : "text-gray-500"} />
              스킬 설정
            </button>
          </nav>
        </aside>

        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#0b0f19]">
          <header className="flex shrink-0 items-center justify-between border-b border-gray-800 p-6">
            <div>
              <h2 className="mb-1 text-2xl font-bold text-white">
                {settingsTab === "connection" && "연결 설정"}
                {settingsTab === "mcp" && "MCP 설정"}
                {settingsTab === "skills" && "스킬 설정"}
                {settingsTab === "preset" && "프리셋 스튜디오"}
              </h2>
              <p className="text-sm text-gray-400">
                {settingsTab === "connection" && "AI 모델 연결을 설정하고 관리하세요."}
                {settingsTab === "mcp" && "MCP 서버 목록과 활성 상태를 워크스페이스 단위로 관리합니다."}
                {settingsTab === "skills" && "프로젝트 스킬을 추가·삭제하고 Claude Code 스킬 사용 여부를 관리합니다."}
                {settingsTab === "preset" && "원하는 관점과 실행 컨텍스트로 새 프리셋을 설계하세요."}
              </p>
            </div>
            <button onClick={onClose} className="-mr-2 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white" aria-label={getCloseLabel(uiLocale)} type="button">
              <X size={24} />
            </button>
          </header>

          <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
            {settingsTab === "connection" ? (
              <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-800/50 bg-blue-900/30 text-sm font-bold text-blue-400">1</div>
                    <h3 className="text-lg font-semibold text-white">AI 공급사 연결</h3>
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-[#121826] p-5">
                    <div className="space-y-2">
                      <label className="mb-2 block text-sm font-medium text-gray-400">공급사 선택</label>
                      <div className="relative">
                        <Select className="appearance-none rounded-xl border-gray-700 bg-[#0b0f19]" value={connectionDraft.providerId} disabled={!hasProviders} onChange={(event: ChangeEvent<HTMLSelectElement>) => onConnectionProviderChange(event.target.value)}>
                          {providerOptions.map((provider) => (
                            <option key={provider.id} value={provider.id}>{provider.label}</option>
                          ))}
                        </Select>
                        <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="mb-2 block text-sm font-medium text-gray-400">로그인 방식</label>
                      <div className="relative">
                        <Select className="appearance-none rounded-xl border-gray-700 bg-[#0b0f19]" value={connectionDraft.authMode} disabled={!connectionProvider} onChange={(event: ChangeEvent<HTMLSelectElement>) => onConnectionAuthModeChange(event.target.value)}>
                          {(connectionProvider?.authModes ?? []).map((authOption) => (
                            <option key={authOption.id} value={authOption.id}>{authOption.label}</option>
                          ))}
                        </Select>
                        <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                      </div>
                      <p className="text-xs text-gray-600">{connectionAuthOption?.description ?? copy.connection.authDescriptionFallback}</p>
                    </div>

                    <div className="rounded-[18px] border border-gray-800 bg-gray-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-gray-400">{copy.connection.status}</span>
                        <Badge className={isProviderConnected ? "border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-400" : "border-gray-700 bg-gray-800 px-2.5 py-1 text-[10px] text-gray-400"}>
                          {isProviderConnected ? copy.connection.connected : copy.connection.notConnected}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-gray-500">{isProviderConnected ? copy.connection.connectedDescription : copy.connection.notConnectedDescription}</p>
                    </div>

                    {connectionAuthOption?.type === "api" ? (
                      <div className="space-y-2">
                        <label className="mb-2 block text-sm font-medium text-gray-400">{connectionAuthOption.inputLabel ?? copy.connection.apiKey}</label>
                        <Input type="password" className="rounded-xl border-gray-700 bg-[#0b0f19]" value={connectionDraft.apiKey} onChange={(event: ChangeEvent<HTMLInputElement>) => onConnectionApiKeyChange(event.target.value)} placeholder={connectionAuthOption.inputPlaceholder ?? copy.connection.apiPlaceholder} />
                        <p className="text-xs leading-5 text-gray-500">{copy.connection.apiHelp}</p>
                      </div>
                    ) : null}

                    {connectionAuthOption?.type === "oauth" ? (
                      <div className="rounded-[20px] border border-gray-800 bg-gray-900/70 p-4">
                        <div className="flex flex-wrap gap-2">
                          {isProviderConnected ? (
                            <Button type="button" variant="ghost" size="sm" className="h-10 rounded-xl border border-gray-700 bg-gray-800 px-4 text-gray-200 hover:bg-gray-700" onClick={onDisconnectAuth}>
                              {copy.connection.disconnect}
                            </Button>
                          ) : (
                            <Button type="button" size="sm" className="h-10 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-500" onClick={onOpenLogin}>
                              <LogIn className="mr-2 h-4 w-4" />
                              {copy.connection.openLogin}
                            </Button>
                          )}
                        </div>
                        <p className="mt-3 text-xs leading-5 text-gray-500">{isProviderConnected ? copy.connection.oauthConnectedDescription : copy.connection.oauthStartDescription}</p>
                      </div>
                    ) : null}

                    {pendingOauth ? (
                      <div className="rounded-[20px] border border-orange-500/20 bg-orange-500/8 p-4">
                        <p className="text-sm font-medium text-gray-100">{copy.connection.oauthProgress}</p>
                        <p className="mt-2 text-xs leading-5 text-gray-400">{pendingOauth.instructions}</p>
                        {pendingOauth.method === "code" ? (
                          <div className="mt-3 space-y-3">
                            <Input className="h-12 rounded-[18px] border-orange-500/20 bg-gray-900/80 text-sm text-gray-100" value={pendingOauth.code} onChange={(event: ChangeEvent<HTMLInputElement>) => onPendingOauthCodeChange(event.target.value)} placeholder={copy.connection.oauthCodePlaceholder} />
                            <Button type="button" className="h-11 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-500" onClick={onCompleteOauth} disabled={pendingOauth.isSubmitting || pendingOauth.code.trim().length === 0}>
                              {pendingOauth.isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                              {copy.connection.oauthComplete}
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs leading-5 text-gray-400">{copy.connection.oauthAutoDescription}</p>
                            <p className="text-xs leading-5 text-gray-500">{copy.connection.oauthFallbackHint}</p>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="space-y-2 pt-1">
                      <button type="button" className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-medium transition-all duration-200 ${isSettingsConnectionSaved ? "border border-gray-700 bg-gray-800 text-green-400" : connectionProvider ? "bg-blue-600 text-white hover:bg-blue-700" : "cursor-not-allowed bg-gray-800 text-gray-500"}`} onClick={onSaveConnection} disabled={isSavingConnection || !connectionProvider}>
                        {isSavingConnection ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : isSettingsConnectionSaved ? <><CheckCircle2 size={18} /> 연결됨</> : copy.connection.save}
                      </button>
                      <p className="text-xs leading-5 text-gray-500">{copy.connection.savedAt}: {formatUiTimestamp(savedSettings.updatedAt, uiLocale)}</p>
                    </div>
                  </div>

                  {isSettingsConnectionSaved ? (
                    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-blue-800/50 bg-blue-900/20 p-5 animate-in fade-in zoom-in-95 duration-300 sm:flex-row sm:items-center">
                      <div>
                        <h4 className="mb-1 font-medium text-blue-100">연결이 완료되었습니다</h4>
                        <p className="text-sm text-blue-300/80">이제 프리셋 스튜디오에서 AI 설정을 진행해보세요.</p>
                      </div>
                      <button type="button" onClick={() => onSwitchTab("preset")} className="whitespace-nowrap rounded-lg bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-600/30">
                        프리셋 스튜디오로 이동 →
                      </button>
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}

            {settingsTab === "mcp" ? (
              <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-800/50 bg-blue-900/30 text-sm font-bold text-blue-400">2</div>
                    <h3 className="text-lg font-semibold text-white">MCP 서버</h3>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-gray-800 bg-[#121826] p-5">
                    <label className="flex items-start gap-3 rounded-[18px] border border-gray-800 bg-[#0b0f19] p-4 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500"
                        checked={mcpSettings.enabled}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => onMcpSettingsChange({ ...mcpSettings, enabled: event.target.checked })}
                      />
                      <span className="space-y-1">
                        <span className="block font-medium text-gray-100">MCP 허용</span>
                        <span className="block text-xs leading-5 text-gray-500">OpenCode에 이미 등록된 MCP 서버를 이 워크스페이스에서 사용할지 결정합니다.</span>
                      </span>
                    </label>

                    <div className="space-y-3">
                      {mcpSettings.servers.map((server, index) => {
                        const serverIdentity =
                          server.type === "local"
                            ? `${server.name}-${server.type}-${server.command.join(" ")}`
                            : `${server.name}-${server.type}-${server.url}`;

                        return (
                          <div
                            key={`${serverIdentity}-${index}`}
                            className="rounded-[18px] border border-gray-800 bg-[#0b0f19] p-4 text-sm text-gray-200"
                          >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-gray-100">{server.name}</div>
                              <div className="mt-1 text-xs text-gray-500">{server.type === "local" ? server.command?.join(" ") : server.url}</div>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                                <span>status: {server.status ?? "unknown"}</span>
                                <span>resources: {server.resourceCount ?? 0}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500"
                                checked={server.enabled}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                  const nextServers = [...mcpSettings.servers];
                                  nextServers[index] = { ...server, enabled: event.target.checked };
                                  onMcpSettingsChange({ ...mcpSettings, servers: nextServers });
                                }}
                              />
                              <button
                                type="button"
                                className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                                onClick={() => onMcpSettingsChange({ ...mcpSettings, servers: mcpSettings.servers.filter((_, itemIndex) => itemIndex !== index) })}
                                aria-label={`${server.name} 제거`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-[18px] border border-dashed border-gray-800 bg-[#0b0f19] p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                        <Input value={newMcpName} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewMcpName(event.target.value)} placeholder="server-name" className="rounded-xl border-gray-700 bg-[#121826]" />
                        <div className="relative">
                          <Select value={newMcpType} onChange={(event: ChangeEvent<HTMLSelectElement>) => setNewMcpType(event.target.value as "local" | "remote")} className="rounded-xl border-gray-700 bg-[#121826]">
                            <option value="local">Local</option>
                            <option value="remote">Remote</option>
                          </Select>
                          <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-3">
                        <Input value={newMcpTarget} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewMcpTarget(event.target.value)} placeholder={newMcpType === "local" ? "npx -y @modelcontextprotocol/server-github" : "https://mcp.example.com"} className="rounded-xl border-gray-700 bg-[#121826]" />
                        <Button
                          type="button"
                          className="rounded-xl bg-gray-100 px-4 text-gray-900 hover:bg-white"
                          onClick={() => {
                            const name = newMcpName.trim();
                            const target = newMcpTarget.trim();
                            if (!name || !target) {
                              return;
                            }

                            const nextServer = newMcpType === "local"
                              ? { name, enabled: true, type: "local" as const, command: target.split(/\s+/).filter(Boolean), resourceCount: 0 }
                              : { name, enabled: true, type: "remote" as const, url: target, resourceCount: 0 };
                            onMcpSettingsChange({ ...mcpSettings, servers: [...mcpSettings.servers, nextServer] });
                            setNewMcpName("");
                            setNewMcpTarget("");
                          }}
                        >
                          <Plus size={16} className="mr-1" />
                          MCP 추가
                        </Button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-gray-500">로컬 MCP는 실행 명령을, 원격 MCP는 URL을 입력하세요.</p>
                    </div>

                    <div className="rounded-[18px] border border-gray-800 bg-gray-950/60 p-4 text-xs leading-5 text-gray-500">
                      MCP는 OpenCode workspace config에 반영되고, 개별 서버 활성 상태도 함께 저장됩니다. 현재 저장된 모델은 {savedSettings.modelId || "없음"} 입니다.
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-medium transition-all duration-200 ${isSavingMcpSettings ? "bg-gray-700 text-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                        onClick={onSaveMcpSettings}
                        disabled={isSavingMcpSettings}
                      >
                        {isSavingMcpSettings ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : "MCP 설정 저장"}
                      </button>
                      <p className="text-xs leading-5 text-gray-500">저장 후 새 세션 실행부터 적용됩니다.</p>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {settingsTab === "skills" ? (
              <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-800/50 bg-blue-900/30 text-sm font-bold text-blue-400">3</div>
                    <h3 className="text-lg font-semibold text-white">프로젝트 스킬</h3>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-gray-800 bg-[#121826] p-5">
                    <label className="flex items-start gap-3 rounded-[18px] border border-gray-800 bg-[#0b0f19] p-4 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500"
                        checked={skillsSettings.enabled}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => onSkillsSettingsChange({ ...skillsSettings, enabled: event.target.checked })}
                      />
                      <span className="space-y-1">
                        <span className="block font-medium text-gray-100">스킬 허용</span>
                        <span className="block text-xs leading-5 text-gray-500">Claude Code 스킬 로딩을 허용합니다. 변경 사항은 다음 OpenCode 서버 재시작 이후 반영됩니다.</span>
                      </span>
                    </label>

                    <div className="space-y-3">
                      {skillsSettings.managed.map((skill, index) => {
                        const skillIdentity = `${skill.name}-${skill.location}`;

                        return (
                          <div
                            key={`${skillIdentity}-${index}`}
                            className="rounded-[18px] border border-gray-800 bg-[#0b0f19] p-4 text-sm text-gray-200"
                          >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-gray-100">{skill.name}</div>
                              <div className="mt-1 text-xs text-gray-500">{skill.description}</div>
                              <div className="mt-2 text-[11px] text-gray-600">{skill.location}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500"
                                checked={skill.enabled}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                  const nextManaged = [...skillsSettings.managed];
                                  nextManaged[index] = { ...skill, enabled: event.target.checked };
                                  onSkillsSettingsChange({ ...skillsSettings, managed: nextManaged });
                                }}
                              />
                              <button
                                type="button"
                                className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-100"
                                onClick={() => onSkillsSettingsChange({ ...skillsSettings, managed: skillsSettings.managed.filter((_, itemIndex) => itemIndex !== index) })}
                                aria-label={`${skill.name} 제거`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-[18px] border border-dashed border-gray-800 bg-[#0b0f19] p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input value={newSkillName} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewSkillName(event.target.value)} placeholder="release-checklist" className="rounded-xl border-gray-700 bg-[#121826]" />
                        <Input value={newSkillDescription} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewSkillDescription(event.target.value)} placeholder="Project release checklist" className="rounded-xl border-gray-700 bg-[#121826]" />
                      </div>
                      <Textarea value={newSkillContent} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNewSkillContent(event.target.value)} placeholder="# Release checklist\n\n1. Verify staging" className="mt-3 rounded-xl border-gray-700 bg-[#121826]" />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs leading-5 text-gray-500">프로젝트 `.opencode/skills`에 저장되며, 비활성화된 스킬은 별도 디렉터리로 이동해 로딩에서 제외됩니다.</p>
                        <Button
                          type="button"
                          className="rounded-xl bg-gray-100 px-4 text-gray-900 hover:bg-white"
                          onClick={() => {
                            const name = newSkillName.trim();
                            const description = newSkillDescription.trim();
                            const content = newSkillContent.trim();
                            if (!name || !description || !content) {
                              return;
                            }

                            onSkillsSettingsChange({
                              ...skillsSettings,
                              managed: [...skillsSettings.managed, {
                                name,
                                description,
                                content,
                                enabled: true,
                                managed: true,
                                location: `.opencode/skills/${name}/SKILL.md`
                              }]
                            });
                            setNewSkillName("");
                            setNewSkillDescription("");
                            setNewSkillContent("");
                          }}
                        >
                          <Plus size={16} className="mr-1" />
                          스킬 추가
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-gray-800 bg-gray-950/60 p-4 text-xs leading-5 text-gray-500">
                      현재 감지된 스킬 {skillsSettings.available.length}개 · 프로젝트 관리 스킬 {skillsSettings.managed.length}개
                    </div>

                      <div className="space-y-2 rounded-[18px] border border-gray-800 bg-gray-950/60 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">감지된 스킬 목록</div>
                        {skillsSettings.available.map((skill, index) => {
                          const skillIdentity = `${skill.name}-${skill.location}`;

                          return (
                            <div
                              key={`${skillIdentity}-${index}`}
                              className="rounded-xl border border-gray-800 bg-[#0b0f19] px-3 py-2 text-sm text-gray-200"
                            >
                              <div className="font-medium text-gray-100">{skill.name}</div>
                              <div className="text-xs text-gray-500">{skill.description}</div>
                            </div>
                          );
                        })}
                      </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-medium transition-all duration-200 ${isSavingSkillsSettings ? "bg-gray-700 text-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                        onClick={onSaveSkillsSettings}
                        disabled={isSavingSkillsSettings}
                      >
                        {isSavingSkillsSettings ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : "스킬 설정 저장"}
                      </button>
                      <p className="text-xs leading-5 text-gray-500">저장 후 OpenCode가 다시 시작되면 감지 목록이 갱신됩니다.</p>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {settingsTab === "preset" ? (
              <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <section className="relative">
                  <div className="relative">
                    {isPresetTabLocked ? (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl border border-gray-800/50 bg-[#0b0f19]/70 backdrop-blur-[2px] transition-all duration-500">
                        <div className="mb-4 rounded-full bg-gray-800 p-3 text-gray-400 shadow-lg"><Lock size={20} /></div>
                        <p className="mb-4 text-base font-medium text-gray-300">연결 설정에서 공급사를 먼저 연결해주세요</p>
                        <button type="button" onClick={() => onSwitchTab("connection")} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-blue-700">
                          연결 설정으로 이동하기
                        </button>
                      </div>
                    ) : null}

                    <div className={`space-y-4 rounded-2xl border border-gray-800 bg-[#121826] p-5 transition-all duration-500 ${isPresetTabLocked ? "pointer-events-none opacity-30" : "opacity-100"}`}>
                      <div className="rounded-2xl border border-gray-800/80 bg-[#0b0f19] p-5">
                        <h4 className="mb-1 font-medium text-gray-200">생성 컨텍스트</h4>
                        <p className="mb-5 text-sm text-gray-500">여기서 선택한 모델과 언어는 다음 세션 생성 화면에도 그대로 이어집니다.</p>
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-400">세션 모델</label>
                            <div className="relative mb-2">
                              <Select className="w-full appearance-none rounded-xl border border-gray-700 bg-[#121826] px-4 py-3.5 text-white transition-colors focus:border-blue-500 focus:outline-none" value={form.model} disabled={!sessionProvider || sessionModelOptions.length === 0} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFormChange({ model: event.target.value })}>
                                {sessionModelOptions.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                              </Select>
                              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            </div>
                            <p className="text-xs text-gray-600">structured output</p>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-400">세션 언어</label>
                            <div className="relative mb-2">
                              <Select className="w-full appearance-none rounded-xl border border-gray-700 bg-[#121826] px-4 py-3.5 text-white transition-colors focus:border-blue-500 focus:outline-none" value={form.language} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFormChange({ language: event.target.value as SessionLanguage })}>
                                {sessionLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </Select>
                              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            </div>
                            <p className="text-xs text-gray-600">토론과 결론을 {form.language === "en" ? "English" : form.language === "ja" ? "日本語" : "한국어"}로 생성합니다.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-800/80 bg-[#0b0f19] p-5">
                        <div className="mb-1 flex items-start justify-between">
                          <h4 className="font-medium text-gray-200">커스텀 프리셋 생성</h4>
                          <div className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300">{generatedPresetAgentCount}명 에이전트</div>
                        </div>
                        <p className="mb-5 text-sm text-gray-500">원하는 관점과 에이전트 수를 적으면 AI가 바로 새 프리셋을 설계합니다.</p>
                        <div className="mb-6">
                          <label className="mb-2 block text-sm font-medium text-gray-400">프리셋 지시문</label>
                          <Textarea className="rounded-xl border-gray-700 bg-[#121826]" value={generatedPresetPrompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onGeneratedPresetPromptChange(event.target.value)} placeholder="예: 초기 SaaS 온보딩을 검토할 프리셋. 고객 성공, UX, 가격 정책 관점이 필요해." />
                        </div>
                        <div className="flex flex-col items-end gap-4 sm:flex-row">
                          <div className="w-full sm:w-auto">
                            <label className="mb-2 block text-sm font-medium text-gray-400">에이전트 수</label>
                            <div className="flex gap-2">
                              {[1, 3, 5].map((num) => (
                                <button key={num} type="button" onClick={() => onGeneratedPresetAgentCountChange(clampAgentCount(num))} className={`rounded-xl px-5 py-3.5 text-sm font-medium transition-colors ${generatedPresetAgentCount === num ? "border border-gray-600 bg-gray-700 text-white" : "border border-gray-800 bg-[#121826] text-gray-400 hover:bg-gray-800"}`}>
                                  {num}명
                                </button>
                              ))}
                            </div>
                          </div>
                          <button type="button" onClick={onGeneratePreset} disabled={isGeneratingPreset || generatedPresetPrompt.trim().length < 10 || !savedSettings.providerId || !form.model || !savedConnectionState.connected || isConnectionDirty} className={`flex w-full flex-1 items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition-all duration-300 sm:text-base ${isPresetGenerationSuccess ? "bg-green-600 text-white" : "bg-white text-gray-900 hover:bg-gray-100 active:scale-[0.99]"}`}>
                            {isGeneratingPreset ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" /> : isPresetGenerationSuccess ? <><CheckCircle2 size={20} /> 프리셋 생성 완료</> : <><Sparkles size={20} /> AI로 프리셋 생성</>}
                          </button>
                        </div>
                        <p className="mt-4 text-center text-xs text-gray-600 sm:text-left">저장된 연결 설정과 세션 환경을 바탕으로 새로운 프리셋을 구축합니다.</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-800 bg-[#090d1a] px-6 py-4">
            {shouldReturnToSession ? (
              <Button variant="secondary" className="bg-gray-800 text-white hover:bg-gray-700" onClick={onReturnToSession}>
                {getReturnToSessionLabel(uiLocale)}
              </Button>
            ) : null}
            <Button variant="secondary" className="bg-gray-800 text-white hover:bg-gray-700" onClick={onClose}>
              {getCloseLabel(uiLocale)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
