import { type ChangeEvent, type FC, useState } from "react";
import { CheckCircle2, ChevronDown, Cpu, LoaderCircle, Lock, LogIn, Plus, Settings2, Sparkles, Trash2, X } from "lucide-react";

import { GENERATED_PRESET_AGENT_COUNT_MIN, GENERATED_PRESET_PROMPT_MIN_LENGTH } from "@pillow-council/agents";
import type { ProviderConnectionState } from "@pillow-council/providers";
import type { DefaultInstallCatalog } from "@pillow-council/providers";
import type { AppSettings, PresetDefinition, ProviderOption, SessionLanguage } from "@pillow-council/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clampAgentCount, type ConnectionDraft } from "@/lib/council-app-helpers";
import {
  getCloseLabel,
  getReturnToSessionLabel,
  getStructuredOutputReadyLabel
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
  defaultInstallCatalog: DefaultInstallCatalog;
  installingDefaultId: string | null;
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
  onInstallDefaultMcp: (id: string) => void;
  onInstallDefaultSkill: (id: string) => void;
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
  defaultInstallCatalog,
  installingDefaultId,
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
  onInstallDefaultMcp,
  onInstallDefaultSkill,
  onFormChange,
  onGeneratedPresetPromptChange,
  onGeneratedPresetAgentCountChange,
  onGeneratePreset
}) => {
  const modalCopy = {
    settings: uiLocale === "ja" ? "設定" : uiLocale === "ko" ? "설정" : "Settings",
    workspace: uiLocale === "ja" ? "ワークスペース" : uiLocale === "ko" ? "워크스페이스" : "Workspace",
    connectionTab: uiLocale === "ja" ? "接続設定" : uiLocale === "ko" ? "연결 설정" : "Connection",
    presetTab: uiLocale === "ja" ? "プリセットスタジオ" : uiLocale === "ko" ? "프리셋 스튜디오" : "Preset Studio",
    mcpTab: uiLocale === "ja" ? "MCP 設定" : uiLocale === "ko" ? "MCP 설정" : "MCP Settings",
    skillsTab: uiLocale === "ja" ? "スキル設定" : uiLocale === "ko" ? "스킬 설정" : "Skill Settings",
    connectionDescription: uiLocale === "ja" ? "AI モデル接続を設定して管理します。" : uiLocale === "ko" ? "AI 모델 연결을 설정하고 관리하세요." : "Configure and manage AI model connections.",
    mcpDescription: uiLocale === "ja" ? "MCP サーバー一覧と有効状態をワークスペース単位で管理します。" : uiLocale === "ko" ? "MCP 서버 목록과 활성 상태를 워크스페이스 단위로 관리합니다." : "Manage MCP servers and their enabled state for this workspace.",
    skillsDescription: uiLocale === "ja" ? "プロジェクトスキルを追加・削除し、Claude Code スキル利用を管理します。" : uiLocale === "ko" ? "프로젝트 스킬을 추가·삭제하고 Claude Code 스킬 사용 여부를 관리합니다." : "Add and remove project skills and control Claude Code skill usage.",
    presetDescription: uiLocale === "ja" ? "必要な視点と実行コンテキストで新しいプリセットを設計します。" : uiLocale === "ko" ? "원하는 관점과 실행 컨텍스트로 새 프리셋을 설계하세요." : "Design a new preset around the viewpoints and execution context you need.",
    installNow: uiLocale === "ja" ? "今すぐインストール" : uiLocale === "ko" ? "바로 설치" : "Install now",
    addMcp: uiLocale === "ja" ? "MCP を追加" : uiLocale === "ko" ? "MCP 추가" : "Add MCP",
    addSkill: uiLocale === "ja" ? "スキル追加" : uiLocale === "ko" ? "스킬 추가" : "Add Skill",
    localOption: uiLocale === "ja" ? "ローカル" : uiLocale === "ko" ? "로컬" : "Local",
    remoteOption: uiLocale === "ja" ? "リモート" : uiLocale === "ko" ? "원격" : "Remote",
    serverNamePlaceholder: uiLocale === "ja" ? "サーバー名" : uiLocale === "ko" ? "server-name" : "server-name",
    skillNamePlaceholder: uiLocale === "ja" ? "リリースチェックリスト" : uiLocale === "ko" ? "release-checklist" : "release-checklist",
    skillDescriptionPlaceholder: uiLocale === "ja" ? "0.1.0 公開チェックリスト" : uiLocale === "ko" ? "Project release checklist" : "Project release checklist",
    skillContentPlaceholder: uiLocale === "ja" ? "# 0.1.0 公開チェックリスト\n\n1. ステージングを確認する" : uiLocale === "ko" ? "# Release checklist\n\n1. Verify staging" : "# Release checklist\n\n1. Verify staging",
    saveMcp: uiLocale === "ja" ? "MCP 設定を保存" : uiLocale === "ko" ? "MCP 설정 저장" : "Save MCP Settings",
    saveSkills: uiLocale === "ja" ? "スキル設定を保存" : uiLocale === "ko" ? "스킬 설정 저장" : "Save Skill Settings",
    aiProviderConnection: uiLocale === "ja" ? "AI プロバイダー接続" : uiLocale === "ko" ? "AI 공급사 연결" : "AI Provider Connection",
    mcpServers: uiLocale === "ja" ? "MCP サーバー" : uiLocale === "ko" ? "MCP 서버" : "MCP Servers",
    projectSkills: uiLocale === "ja" ? "プロジェクトスキル" : uiLocale === "ko" ? "프로젝트 스킬" : "Project Skills",
    mcpEnabledTitle: uiLocale === "ja" ? "MCP を許可" : uiLocale === "ko" ? "MCP 허용" : "Enable MCP",
    mcpEnabledDescription: uiLocale === "ja" ? "OpenCode に登録済みの MCP サーバーをこのワークスペースで使うかを決めます。" : uiLocale === "ko" ? "OpenCode에 이미 등록된 MCP 서버를 이 워크스페이스에서 사용할지 결정합니다." : "Choose whether MCP servers already registered in OpenCode are allowed in this workspace.",
    quickMcpInstall: uiLocale === "ja" ? "デフォルト MCP クイックインストール" : uiLocale === "ko" ? "기본 MCP 빠른 설치" : "Default MCP quick install",
    localMcpHint: uiLocale === "ja" ? "ローカル MCP には実行コマンドを、リモート MCP には URL を入力してください。" : uiLocale === "ko" ? "로컬 MCP는 실행 명령을, 원격 MCP는 URL을 입력하세요." : "Enter a launch command for local MCP servers and a URL for remote MCP servers.",
    mcpSaveHint: uiLocale === "ja" ? "保存後、次のセッション実行から適用されます。" : uiLocale === "ko" ? "저장 후 새 세션 실행부터 적용됩니다." : "Changes apply starting with the next session run after saving.",
    skillEnabledTitle: uiLocale === "ja" ? "スキルを許可" : uiLocale === "ko" ? "스킬 허용" : "Enable skills",
    skillEnabledDescription: uiLocale === "ja" ? "Claude Code スキルの読み込みを許可します。変更は次の OpenCode サーバー再起動後に反映されます。" : uiLocale === "ko" ? "Claude Code 스킬 로딩을 허용합니다. 변경 사항은 다음 OpenCode 서버 재시작 이후 반영됩니다." : "Allow Claude Code skills. Changes take effect after the next OpenCode server restart.",
    quickSkillInstall: uiLocale === "ja" ? "デフォルトスキル クイックインストール" : uiLocale === "ko" ? "기본 스킬 빠른 설치" : "Default skill quick install",
    skillsSaveHint: uiLocale === "ja" ? "保存後、OpenCode が再起動すると検出一覧が更新されます。" : uiLocale === "ko" ? "저장 후 OpenCode가 다시 시작되면 감지 목록이 갱신됩니다." : "After saving, the detected list refreshes when OpenCode restarts.",
    skillsPathHint: uiLocale === "ja" ? "`~/.pillow-council/skills` に保存され、無効化したスキルは `skills-disabled` ディレクトリへ移動して読み込み対象から外れます。" : uiLocale === "ko" ? "`~/.pillow-council/skills`에 저장되며, 비활성화된 스킬은 `skills-disabled` 디렉터리로 이동해 로딩에서 제외됩니다." : "Saved under `~/.pillow-council/skills`; disabled skills move to `skills-disabled` and are excluded from loading.",
    detectedSkillsList: uiLocale === "ja" ? "検出されたスキル一覧" : uiLocale === "ko" ? "감지된 스킬 목록" : "Detected skills",
    generationContext: uiLocale === "ja" ? "生成コンテキスト" : uiLocale === "ko" ? "생성 컨텍스트" : "Generation Context",
    generationContextDescription: uiLocale === "ja" ? "ここで選んだモデルと言語は次のセッション作成画面にも引き継がれます。" : uiLocale === "ko" ? "여기서 선택한 모델과 언어는 다음 세션 생성 화면에도 그대로 이어집니다." : "The model and language selected here carry into the next session creation flow.",
    sessionModel: uiLocale === "ja" ? "セッションモデル" : uiLocale === "ko" ? "세션 모델" : "Session model",
    sessionLanguage: uiLocale === "ja" ? "セッション言語" : uiLocale === "ko" ? "세션 언어" : "Session language",
    customPresetGeneration: uiLocale === "ja" ? "カスタムプリセット生成" : uiLocale === "ko" ? "커스텀 프리셋 생성" : "Custom preset generation",
    customPresetDescription: uiLocale === "ja" ? "必要な視点とエージェント数を入力すると、AI が新しいプリセットを設計します。" : uiLocale === "ko" ? "원하는 관점과 에이전트 수를 적으면 AI가 바로 새 프리셋을 설계합니다." : "Describe the perspectives and agent count you need and AI will design a fresh preset.",
    presetPromptLabel: uiLocale === "ja" ? "プリセット指示" : uiLocale === "ko" ? "프리셋 지시문" : "Preset brief",
    presetPromptPlaceholder: uiLocale === "ja" ? "例: 初期 SaaS オンボーディングを見直すためのプリセット。顧客成功、UX、価格方針の視点が必要。" : uiLocale === "ko" ? "예: 초기 SaaS 온보딩을 검토할 프리셋. 고객 성공, UX, 가격 정책 관점이 필요해." : "Example: A preset to review SaaS onboarding with customer success, UX, and pricing perspectives.",
    agentCount: uiLocale === "ja" ? "エージェント数" : uiLocale === "ko" ? "에이전트 수" : "Agent count",
    generatedPresetDone: uiLocale === "ja" ? "プリセット生成完了" : uiLocale === "ko" ? "프리셋 생성 완료" : "Preset generated",
    generateWithAi: uiLocale === "ja" ? "AI でプリセット生成" : uiLocale === "ko" ? "AI로 프리셋 생성" : "Generate with AI",
    moveToPresetStudio: uiLocale === "ja" ? "プリセットスタジオへ移動 →" : uiLocale === "ko" ? "프리셋 스튜디오로 이동 →" : "Go to preset studio →",
    moveToConnection: uiLocale === "ja" ? "接続設定へ移動" : uiLocale === "ko" ? "연결 설정으로 이동하기" : "Go to connection settings",
    connectionReadyTitle: uiLocale === "ja" ? "接続が完了しました" : uiLocale === "ko" ? "연결이 완료되었습니다" : "Connection is ready",
    connectionReadyDescription: uiLocale === "ja" ? "次はプリセットスタジオで AI 設定を進めてください。" : uiLocale === "ko" ? "이제 프리셋 스튜디오에서 AI 설정을 진행해보세요." : "Next, continue with AI setup in the preset studio.",
    removeLabel: (name: string) => uiLocale === "ja" ? `${name} を削除` : uiLocale === "ko" ? `${name} 제거` : `Remove ${name}`,
    mcpInfo: (modelId: string) => uiLocale === "ja" ? `MCP は OpenCode workspace config に反映され、個別サーバーの有効状態も一緒に保存されます。現在保存されているモデルは ${modelId || "なし"} です。` : uiLocale === "ko" ? `MCP는 OpenCode workspace config에 반영되고, 개별 서버 활성 상태도 함께 저장됩니다. 현재 저장된 모델은 ${modelId || "없음"} 입니다.` : `MCP entries are written to the OpenCode workspace config and persist individual server enablement. The currently saved model is ${modelId || "none"}.`,
    mcpStatusLabel: uiLocale === "ja" ? "状態" : uiLocale === "ko" ? "상태" : "Status",
    mcpResourcesLabel: uiLocale === "ja" ? "リソース" : uiLocale === "ko" ? "리소스" : "Resources",
    skillsInfo: (available: number, managed: number) => uiLocale === "ja" ? `現在検出されたスキル ${available} 件 · プロジェクト管理スキル ${managed} 件` : uiLocale === "ko" ? `현재 감지된 스킬 ${available}개 · 프로젝트 관리 스킬 ${managed}개` : `${available} detected skills · ${managed} managed project skills`,
    languageOutputHint: (language: SessionLanguage) => uiLocale === "ja" ? `討論と結論を ${language === "en" ? "English" : language === "ja" ? "日本語" : "한국어"} で生成します。` : uiLocale === "ko" ? `토론과 결론을 ${language === "en" ? "English" : language === "ja" ? "日本語" : "한국어"}로 생성합니다.` : `Generate the debate and final decision in ${language === "en" ? "English" : language === "ja" ? "日本語" : "한국어"}.`
  };

  const [newMcpName, setNewMcpName] = useState("");
  const [newMcpType, setNewMcpType] = useState<"local" | "remote">("local");
  const [newMcpTarget, setNewMcpTarget] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDescription, setNewSkillDescription] = useState("");
  const [newSkillContent, setNewSkillContent] = useState("");
  const trimmedPresetPrompt = generatedPresetPrompt.trim();
  const remainingPresetPromptCharacters = Math.max(0, GENERATED_PRESET_PROMPT_MIN_LENGTH - trimmedPresetPrompt.length);
  const presetGenerationBlockedReason = (() => {
    if (!savedConnectionState.connected) {
      return "not-connected" as const;
    }

    if (isConnectionDirty) {
      return "dirty-connection" as const;
    }

    if (!savedSettings.providerId || !form.model) {
      return "missing-model" as const;
    }

    if (remainingPresetPromptCharacters > 0) {
      return "short-prompt" as const;
    }

    return null;
  })();

  const presetGenerationBlockedMessage = (() => {
    switch (presetGenerationBlockedReason) {
      case "not-connected":
        return uiLocale === "ja" ? "接続設定で先にプロバイダーを接続してください。" : uiLocale === "ko" ? "연결 설정에서 공급사를 먼저 연결해주세요." : "Connect a provider in connection settings first.";
      case "dirty-connection":
        return uiLocale === "ja" ? "接続設定がまだ保存されていません。先に保存してからプリセットを生成してください。" : uiLocale === "ko" ? "연결 설정이 아직 저장되지 않았습니다. 먼저 저장한 뒤 프리셋을 생성해주세요." : "Save the connection settings before generating a preset.";
      case "missing-model":
        return uiLocale === "ja" ? "プリセット生成の前にセッションモデルを選択してください。" : uiLocale === "ko" ? "프리셋 생성 전에 세션 모델을 먼저 선택해주세요." : "Choose a session model before generating a preset.";
      case "short-prompt":
        return uiLocale === "ja" ? `あと ${remainingPresetPromptCharacters} 文字入力するとプリセット生成を開始できます。` : uiLocale === "ko" ? `${remainingPresetPromptCharacters}자만 더 입력하면 프리셋 생성을 시작할 수 있습니다.` : `Enter ${remainingPresetPromptCharacters} more characters to start preset generation.`;
      default:
        return uiLocale === "ja" ? "保存済みの接続設定とセッション環境をもとに新しいプリセットを構築します。" : uiLocale === "ko" ? "저장된 연결 설정과 세션 환경을 바탕으로 새로운 프리셋을 구축합니다." : "Build a fresh preset from the saved connection and current session context.";
    }
  })();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6">
      <div className="flex h-[85vh] max-h-[800px] w-full max-w-5xl overflow-hidden rounded-[24px] border border-gray-800 bg-[#0b0f19] shadow-2xl animate-in zoom-in-95 duration-200">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-800 bg-[#121826] md:flex">
          <div className="p-6">
            <h2 className="text-lg font-bold text-white">{modalCopy.settings}</h2>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            <div className="mb-2 mt-2 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{modalCopy.workspace}</span>
            </div>

            <button
              type="button"
              onClick={() => onSwitchTab("connection")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${settingsTab === "connection" ? "bg-blue-600/10 text-blue-400" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"}`}
            >
              <Settings2 size={18} className={settingsTab === "connection" ? "text-blue-400" : "text-gray-500"} />
              {modalCopy.connectionTab}
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab("preset")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${settingsTab === "preset" ? "bg-blue-600/10 text-blue-400" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"}`}
            >
              <Cpu size={18} className={settingsTab === "preset" ? "text-blue-400" : "text-gray-500"} />
              {modalCopy.presetTab}
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab("mcp")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${settingsTab === "mcp" ? "bg-blue-600/10 text-blue-400" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"}`}
            >
              <Sparkles size={18} className={settingsTab === "mcp" ? "text-blue-400" : "text-gray-500"} />
              {modalCopy.mcpTab}
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab("skills")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${settingsTab === "skills" ? "bg-blue-600/10 text-blue-400" : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"}`}
            >
              <Sparkles size={18} className={settingsTab === "skills" ? "text-blue-400" : "text-gray-500"} />
              {modalCopy.skillsTab}
            </button>
          </nav>
        </aside>

        <div className="relative flex flex-1 flex-col overflow-hidden bg-[#0b0f19]">
          <header className="flex shrink-0 items-center justify-between border-b border-gray-800 p-6">
            <div>
              <h2 className="mb-1 text-2xl font-bold text-white">
                {settingsTab === "connection" && modalCopy.connectionTab}
                {settingsTab === "mcp" && modalCopy.mcpTab}
                {settingsTab === "skills" && modalCopy.skillsTab}
                {settingsTab === "preset" && modalCopy.presetTab}
              </h2>
              <p className="text-sm text-gray-400">
                {settingsTab === "connection" && modalCopy.connectionDescription}
                {settingsTab === "mcp" && modalCopy.mcpDescription}
                {settingsTab === "skills" && modalCopy.skillsDescription}
                {settingsTab === "preset" && modalCopy.presetDescription}
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
                    <h3 className="text-lg font-semibold text-white">{modalCopy.aiProviderConnection}</h3>
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-[#121826] p-5">
                    <div className="space-y-2">
                        <label className="mb-2 block text-sm font-medium text-gray-400">{copy.connection.provider}</label>
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
                        <label className="mb-2 block text-sm font-medium text-gray-400">{copy.connection.loginMethod}</label>
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
                         {isSavingConnection ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : isSettingsConnectionSaved ? <><CheckCircle2 size={18} /> {copy.connection.connected}</> : copy.connection.save}
                      </button>
                      <p className="text-xs leading-5 text-gray-500">{copy.connection.savedAt}: {formatUiTimestamp(savedSettings.updatedAt, uiLocale)}</p>
                    </div>
                  </div>

                  {isSettingsConnectionSaved ? (
                    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-blue-800/50 bg-blue-900/20 p-5 animate-in fade-in zoom-in-95 duration-300 sm:flex-row sm:items-center">
                      <div>
                        <h4 className="mb-1 font-medium text-blue-100">{modalCopy.connectionReadyTitle}</h4>
                        <p className="text-sm text-blue-300/80">{modalCopy.connectionReadyDescription}</p>
                      </div>
                      <button type="button" onClick={() => onSwitchTab("preset")} className="whitespace-nowrap rounded-lg bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-600/30">
                        {modalCopy.moveToPresetStudio}
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
                    <h3 className="text-lg font-semibold text-white">{modalCopy.mcpServers}</h3>
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
                        <span className="block font-medium text-gray-100">{modalCopy.mcpEnabledTitle}</span>
                        <span className="block text-xs leading-5 text-gray-500">{modalCopy.mcpEnabledDescription}</span>
                      </span>
                    </label>

                    <div className="space-y-3">
                      {defaultInstallCatalog.mcpServers.length > 0 ? (
                        <div className="rounded-[18px] border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-cyan-100/80">{modalCopy.quickMcpInstall}</div>
                          <div className="space-y-3">
                            {defaultInstallCatalog.mcpServers.map((server) => (
                              <div key={server.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-800 bg-[#0b0f19] p-3">
                                <div>
                                  <div className="font-medium text-gray-100">{server.name}</div>
                                  <div className="mt-1 text-xs text-gray-500">{server.description}</div>
                                  <div className="mt-2 text-[11px] text-cyan-200/80">{server.command.join(" ")} · {server.sourceLabel}</div>
                                </div>
                                <Button
                                  type="button"
                                  className="rounded-xl bg-cyan-100 px-4 text-cyan-950 hover:bg-white"
                                  disabled={installingDefaultId === server.id}
                                  onClick={() => onInstallDefaultMcp(server.id)}
                                >
                                  {installingDefaultId === server.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus size={16} className="mr-1" />}
                                  {modalCopy.installNow}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

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
                                   <span>{modalCopy.mcpStatusLabel}: {server.status ?? "unknown"}</span>
                                   <span>{modalCopy.mcpResourcesLabel}: {server.resourceCount ?? 0}</span>
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
                                  aria-label={modalCopy.removeLabel(server.name)}
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
                        <Input value={newMcpName} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewMcpName(event.target.value)} placeholder={modalCopy.serverNamePlaceholder} className="rounded-xl border-gray-700 bg-[#121826]" />
                        <div className="relative">
                          <Select value={newMcpType} onChange={(event: ChangeEvent<HTMLSelectElement>) => setNewMcpType(event.target.value as "local" | "remote")} className="rounded-xl border-gray-700 bg-[#121826]">
                            <option value="local">{modalCopy.localOption}</option>
                            <option value="remote">{modalCopy.remoteOption}</option>
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
                          {modalCopy.addMcp}
                        </Button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-gray-500">{modalCopy.localMcpHint}</p>
                    </div>

                    <div className="rounded-[18px] border border-gray-800 bg-gray-950/60 p-4 text-xs leading-5 text-gray-500">
                      {modalCopy.mcpInfo(savedSettings.modelId)}
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-medium transition-all duration-200 ${isSavingMcpSettings ? "bg-gray-700 text-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                        onClick={onSaveMcpSettings}
                        disabled={isSavingMcpSettings}
                      >
                        {isSavingMcpSettings ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : modalCopy.saveMcp}
                      </button>
                      <p className="text-xs leading-5 text-gray-500">{modalCopy.mcpSaveHint}</p>
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
                    <h3 className="text-lg font-semibold text-white">{modalCopy.projectSkills}</h3>
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
                        <span className="block font-medium text-gray-100">{modalCopy.skillEnabledTitle}</span>
                        <span className="block text-xs leading-5 text-gray-500">{modalCopy.skillEnabledDescription}</span>
                      </span>
                    </label>

                    <div className="space-y-3">
                      {defaultInstallCatalog.skills.length > 0 ? (
                        <div className="rounded-[18px] border border-cyan-500/20 bg-cyan-500/5 p-4">
                          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-cyan-100/80">{modalCopy.quickSkillInstall}</div>
                          <div className="space-y-3">
                            {defaultInstallCatalog.skills.map((skill) => (
                              <div key={skill.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-800 bg-[#0b0f19] p-3">
                                <div>
                                  <div className="font-medium text-gray-100">{skill.name}</div>
                                  <div className="mt-1 text-xs text-gray-500">{skill.description}</div>
                                  <div className="mt-2 text-[11px] text-cyan-200/80">{skill.sourceLabel}</div>
                                </div>
                                <Button
                                  type="button"
                                  className="rounded-xl bg-cyan-100 px-4 text-cyan-950 hover:bg-white"
                                  disabled={installingDefaultId === skill.id}
                                  onClick={() => onInstallDefaultSkill(skill.id)}
                                >
                                  {installingDefaultId === skill.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus size={16} className="mr-1" />}
                                  {modalCopy.installNow}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

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
                                  aria-label={modalCopy.removeLabel(skill.name)}
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
                        <Input value={newSkillName} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewSkillName(event.target.value)} placeholder={modalCopy.skillNamePlaceholder} className="rounded-xl border-gray-700 bg-[#121826]" />
                        <Input value={newSkillDescription} onChange={(event: ChangeEvent<HTMLInputElement>) => setNewSkillDescription(event.target.value)} placeholder={modalCopy.skillDescriptionPlaceholder} className="rounded-xl border-gray-700 bg-[#121826]" />
                      </div>
                      <Textarea value={newSkillContent} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNewSkillContent(event.target.value)} placeholder={modalCopy.skillContentPlaceholder} className="mt-3 rounded-xl border-gray-700 bg-[#121826]" />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs leading-5 text-gray-500">{modalCopy.skillsPathHint}</p>
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
                                location: `~/.pillow-council/skills/${name}/SKILL.md`
                              }]
                            });
                            setNewSkillName("");
                            setNewSkillDescription("");
                            setNewSkillContent("");
                          }}
                        >
                          <Plus size={16} className="mr-1" />
                          {modalCopy.addSkill}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-gray-800 bg-gray-950/60 p-4 text-xs leading-5 text-gray-500">
                      {modalCopy.skillsInfo(skillsSettings.available.length, skillsSettings.managed.length)}
                    </div>

                    <div className="space-y-2 rounded-[18px] border border-gray-800 bg-gray-950/60 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{modalCopy.detectedSkillsList}</div>
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
                        {isSavingSkillsSettings ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : modalCopy.saveSkills}
                      </button>
                      <p className="text-xs leading-5 text-gray-500">{modalCopy.skillsSaveHint}</p>
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
                        <p className="mb-4 max-w-sm text-center text-base font-medium text-gray-300">{presetGenerationBlockedMessage}</p>
                        <button type="button" onClick={() => onSwitchTab("connection")} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-blue-700">
                          {modalCopy.moveToConnection}
                        </button>
                      </div>
                    ) : null}

                    <div className={`space-y-4 rounded-2xl border border-gray-800 bg-[#121826] p-5 transition-all duration-500 ${isPresetTabLocked ? "pointer-events-none opacity-30" : "opacity-100"}`}>
                      <div className="rounded-2xl border border-gray-800/80 bg-[#0b0f19] p-5">
                        <h4 className="mb-1 font-medium text-gray-200">{modalCopy.generationContext}</h4>
                        <p className="mb-5 text-sm text-gray-500">{modalCopy.generationContextDescription}</p>
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-400">{modalCopy.sessionModel}</label>
                            <div className="relative mb-2">
                              <Select className="w-full appearance-none rounded-xl border border-gray-700 bg-[#121826] px-4 py-3.5 text-white transition-colors focus:border-blue-500 focus:outline-none" value={form.model} disabled={!sessionProvider || sessionModelOptions.length === 0} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFormChange({ model: event.target.value })}>
                                {sessionModelOptions.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                              </Select>
                              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            </div>
                            <p className="text-xs text-gray-600">{getStructuredOutputReadyLabel(uiLocale)}</p>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-400">{modalCopy.sessionLanguage}</label>
                            <div className="relative mb-2">
                              <Select className="w-full appearance-none rounded-xl border border-gray-700 bg-[#121826] px-4 py-3.5 text-white transition-colors focus:border-blue-500 focus:outline-none" value={form.language} onChange={(event: ChangeEvent<HTMLSelectElement>) => onFormChange({ language: event.target.value as SessionLanguage })}>
                                {sessionLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </Select>
                              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            </div>
                            <p className="text-xs text-gray-600">{modalCopy.languageOutputHint(form.language)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-800/80 bg-[#0b0f19] p-5">
                        <div className="mb-1 flex items-start justify-between">
                          <h4 className="font-medium text-gray-200">{modalCopy.customPresetGeneration}</h4>
                          <div className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300">{generatedPresetAgentCount} {modalCopy.agentCount}</div>
                        </div>
                        <p className="mb-5 text-sm text-gray-500">{modalCopy.customPresetDescription}</p>
                        <div className="mb-6">
                          <label className="mb-2 block text-sm font-medium text-gray-400">{modalCopy.presetPromptLabel}</label>
                          <Textarea className="rounded-xl border-gray-700 bg-[#121826]" value={generatedPresetPrompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onGeneratedPresetPromptChange(event.target.value)} placeholder={modalCopy.presetPromptPlaceholder} />
                        </div>
                        <div className="flex flex-col items-end gap-4 sm:flex-row">
                          <div className="w-full sm:w-auto">
                            <label className="mb-2 block text-sm font-medium text-gray-400">{modalCopy.agentCount}</label>
                            <div className="flex gap-2">
                              {[GENERATED_PRESET_AGENT_COUNT_MIN, 3, 5].map((num) => (
                                <button key={num} type="button" onClick={() => onGeneratedPresetAgentCountChange(clampAgentCount(num))} className={`rounded-xl px-5 py-3.5 text-sm font-medium transition-colors ${generatedPresetAgentCount === num ? "border border-gray-600 bg-gray-700 text-white" : "border border-gray-800 bg-[#121826] text-gray-400 hover:bg-gray-800"}`}>
                                  {num} {modalCopy.agentCount}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button type="button" onClick={onGeneratePreset} disabled={isGeneratingPreset || presetGenerationBlockedReason !== null} className={`flex w-full flex-1 items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition-all duration-300 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500 sm:text-base ${isPresetGenerationSuccess ? "bg-green-600 text-white hover:bg-green-500" : "bg-white text-gray-900 hover:bg-gray-100"}`}>
                            {isGeneratingPreset ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" /> : isPresetGenerationSuccess ? <><CheckCircle2 size={20} /> {modalCopy.generatedPresetDone}</> : <><Sparkles size={20} /> {modalCopy.generateWithAi}</>}
                          </button>
                        </div>
                        <p className="mt-4 text-center text-xs text-gray-600 sm:text-left">{presetGenerationBlockedMessage}</p>
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
