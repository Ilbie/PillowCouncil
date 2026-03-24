import type { DebateIntensity, SessionLanguage } from "@ship-council/shared";

export type UiLocale = SessionLanguage;
export type DecisionSectionKey = "alternatives" | "risks" | "assumptions" | "openQuestions" | "nextActions";

export const UI_LOCALE_STORAGE_KEY = "ship-council-ui-locale";

export const UI_LOCALE_OPTIONS: Array<{ value: UiLocale; label: string }> = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" }
];

const DATE_LOCALES: Record<UiLocale, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP"
};

const COPY = {
  ko: {
    appBadge: "Ship Council MVP",
    headerTitle: "실시간 패널 토론으로 결론까지 정리합니다",
    headerDescription:
      "공급사 연결은 OpenCode에 맡기고, 세션에서는 주제와 프리셋만 정합니다. 실행이 시작되면 라운드와 메시지가 실시간으로 쌓입니다.",
    uiLanguageLabel: "UI 언어",
    noProvider: "공급사 없음",
    noAuthMode: "로그인 방식 없음",
    noModel: "모델 없음",
    errorFallback: "요청을 처리하지 못했습니다.",
    refreshing: "새로고침 중...",
    connection: {
      title: "연결 설정",
      description: "OpenCode에서 공급사, 로그인 방식, 모델을 관리합니다.",
      provider: "공급사",
      loginMethod: "로그인 방식",
      model: "모델",
      authDescriptionFallback: "이 공급사의 인증 방식을 선택하세요.",
      modelDescriptionFallback: "새 세션에 사용할 모델을 선택하세요.",
      status: "OpenCode 상태",
      connected: "연결됨",
      notConnected: "미연결",
      connectedDescription: "이 공급사는 이미 OpenCode credential store에 연결되어 있습니다.",
      notConnectedDescription: "이 공급사에 연결된 OpenCode 인증 정보가 없습니다.",
      apiKey: "API 키",
      apiPlaceholder: "API 키를 입력하세요",
      apiHelp:
        "연결 저장을 누르면 API 키가 OpenCode credential store에 저장됩니다. 이미 OpenCode에 연결되어 있으면 비워 둬도 됩니다.",
      openLogin: "로그인 열기",
      disconnect: "연결 해제",
      oauthConnectedDescription: "이 공급사는 이미 연결되어 있습니다. 계정을 바꾸려면 연결을 해제하세요.",
      oauthStartDescription: "OpenCode가 브라우저 로그인 창을 열고, 인증 정보는 OpenCode 쪽에 저장됩니다.",
      oauthProgress: "OpenCode 로그인 진행 중",
      oauthCodePlaceholder: "로그인 후 받은 코드를 붙여 넣으세요",
      oauthComplete: "로그인 완료",
      oauthAutoDescription: "브라우저 로그인을 끝내면 이 카드가 자동으로 갱신됩니다.",
      oauthFallbackHint: "상태가 계속 바뀌지 않으면 다른 로그인 방식을 시도하거나 연결 상태를 다시 확인하세요.",
      save: "연결 저장",
      savedAt: "마지막 저장"
    },
    session: {
      title: "새 세션",
      description: "세션은 주제, 프리셋, 언어, 반복 횟수만 입력합니다. 저장된 OpenCode 연결을 그대로 재사용합니다.",
      activeConnection: "현재 연결",
      providerNotSaved: "공급사 미저장",
      loginNotSaved: "로그인 미저장",
      modelNotSaved: "모델 미저장",
      connectHint: "새 세션을 시작하기 전에 OpenCode 연결을 저장하거나 로그인하세요.",
      dirtyHint: "연결 설정이 바뀌었습니다. 먼저 저장하세요.",
      titleLabel: "제목",
      titlePlaceholder: "선택 사항",
      topicLabel: "주제",
      topicPlaceholder: "프리셋이 토론할 의사결정 주제를 입력하세요.",
      presetLabel: "프리셋",
      customPresetTitle: "커스텀 프리셋 생성",
      customPresetDescription: "원하는 관점과 에이전트 수를 적으면 AI가 바로 새 프리셋을 설계합니다.",
      customPresetPromptLabel: "프리셋 지시문",
      customPresetPromptPlaceholder: "예: 초기 SaaS 온보딩을 검토할 프리셋. 고객 성공, UX, 가격, 구현, 회의론 관점이 필요해.",
      customPresetAgentCountLabel: "에이전트 수",
      generatePreset: "AI로 프리셋 생성",
      generatedPresetBadge: "AI 생성됨",
      languageLabel: "세션 언어",
      webSearchLabel: "웹 검색",
      webSearchHint: "필요할 때만 웹 검색 도구를 사용해 최신 정보를 확인합니다.",
      debateIntensityLabel: "반복 횟수",
      debateIntensityHint: "의견 -> 반박 사이클을 몇 번 반복할지 정합니다.",
      selectedPreset: "선택한 프리셋",
      create: "세션 생성 후 실행",
      languageSummaryPrefix: "언어",
      debateSummaryPrefix: "반복 횟수"
    },
    sessions: {
      title: "세션 목록",
      description: "저장된 세션을 확인하고 다시 실행할 수 있습니다.",
      empty: "아직 세션이 없습니다."
    },
    detail: {
      emptyTitle: "세션을 선택하세요",
      emptyDescription: "저장된 세션을 선택하거나 새 세션을 만들면 토론 타임라인이 표시됩니다.",
      noRounds: "아직 생성된 라운드가 없습니다.",
      waitingForRounds: "실행은 시작됐지만 아직 첫 메시지가 저장되지 않았습니다.",
      round: "라운드",
      live: "실시간 업데이트 중"
    },
    decision: {
      title: "결정 보드",
      description: "최종 결론, TODO, export를 확인합니다.",
      rerun: "다시 실행",
      stop: "중지",
      markdown: "Markdown",
      json: "JSON",
      empty: "아직 최종 결론이 없습니다.",
      topRecommendation: "최우선 권고안",
      finalSummary: "최종 요약",
      todo: "TODO",
      status: "상태",
      updated: "업데이트",
      metrics: {
        title: "실행 지표",
        mcpCalls: "MCP 호출",
        skillUses: "스킬 사용",
        webSearches: "웹 검색",
        tokens: "토큰",
        duration: "소요 시간"
      }
    },
    decisionSections: {
      alternatives: "대안",
      risks: "리스크",
      assumptions: "가정",
      openQuestions: "열린 질문",
      nextActions: "다음 액션"
    },
    roundStages: {
      opening: "의견",
      rebuttal: "반박",
      summary: "모더레이터 요약",
      final: "최종 권고"
    },
    messageKinds: {
      opinion: "의견",
      rebuttal: "반박",
      summary: "요약",
      final: "최종"
    },
    todoPriorities: {
      high: "높음",
      medium: "보통",
      low: "낮음"
    },
    statuses: {
      draft: "초안",
      queued: "대기 중",
      running: "실행 중",
      stopped: "중지됨",
      completed: "완료",
      failed: "실패"
    },
    languages: {
      ko: { label: "한국어", description: "토론과 결론을 한국어로 생성합니다." },
      en: { label: "영어", description: "토론과 결론을 영어로 생성합니다." },
      ja: { label: "일본어", description: "토론과 결론을 일본어로 생성합니다." }
    }
  },
  en: {
    appBadge: "Ship Council MVP",
    headerTitle: "Run the panel live and watch the debate build in real time",
    headerDescription:
      "OpenCode owns the provider connection. Sessions only capture the topic and preset, then stream progress into the timeline as rounds finish.",
    uiLanguageLabel: "UI language",
    noProvider: "No provider",
    noAuthMode: "No auth mode",
    noModel: "No model",
    errorFallback: "Unable to complete the request.",
    refreshing: "Refreshing...",
    connection: {
      title: "Connection",
      description: "OpenCode manages the provider, login method, and model.",
      provider: "Provider",
      loginMethod: "Login Method",
      model: "Model",
      authDescriptionFallback: "Choose how this provider should authenticate through OpenCode.",
      modelDescriptionFallback: "Choose the model for new sessions.",
      status: "OpenCode status",
      connected: "Connected",
      notConnected: "Not connected",
      connectedDescription: "This provider is already connected in the OpenCode credential store.",
      notConnectedDescription: "No OpenCode credential is currently connected for this provider.",
      apiKey: "API Key",
      apiPlaceholder: "Enter API key",
      apiHelp:
        "Save this connection to write the API key into the OpenCode credential store. If this provider is already configured in OpenCode, you can leave the field empty.",
      openLogin: "Open Login",
      disconnect: "Disconnect",
      oauthConnectedDescription: "This provider is already connected. Disconnect if you want to switch accounts.",
      oauthStartDescription: "OpenCode opens the browser login flow and stores the credential on its side.",
      oauthProgress: "OpenCode login in progress",
      oauthCodePlaceholder: "Paste the returned code",
      oauthComplete: "Complete Login",
      oauthAutoDescription: "Finish the browser flow, then this card will update automatically.",
      oauthFallbackHint: "If the status does not change, try a different login method or refresh the connection state.",
      save: "Save Connection",
      savedAt: "Last saved"
    },
    session: {
      title: "New Session",
      description: "Set the topic, preset, language, and cycle count. The saved OpenCode connection is reused for every run.",
      activeConnection: "Active connection",
      providerNotSaved: "Provider not saved",
      loginNotSaved: "Login not saved",
      modelNotSaved: "Model not saved",
      connectHint: "Connect or save the selected login method in OpenCode before starting a new session.",
      dirtyHint: "You changed the connection. Save it before starting a new session.",
      titleLabel: "Title",
      titlePlaceholder: "Optional session title",
      topicLabel: "Topic",
      topicPlaceholder: "Describe the decision you want the preset to debate.",
      presetLabel: "Preset",
      customPresetTitle: "Generate Custom Preset",
      customPresetDescription: "Describe the perspectives you want and AI will assemble a fresh preset with the agent count you choose.",
      customPresetPromptLabel: "Preset brief",
      customPresetPromptPlaceholder: "Example: Create a preset for reviewing an AI onboarding flow with UX, pricing, delivery, support, and skeptic perspectives.",
      customPresetAgentCountLabel: "Agent count",
      generatePreset: "Generate with AI",
      generatedPresetBadge: "AI generated",
      languageLabel: "Session language",
      webSearchLabel: "Web search",
      webSearchHint: "Allow the model to use web search when it needs fresher external information.",
      debateIntensityLabel: "Cycle count",
      debateIntensityHint: "Controls how many opinion -> rebuttal loops the panel will run.",
      selectedPreset: "Selected preset",
      create: "Create Session and Run",
      languageSummaryPrefix: "Language",
      debateSummaryPrefix: "Cycle count"
    },
    sessions: {
      title: "Sessions",
      description: "Browse saved sessions and reopen any previous run.",
      empty: "No sessions yet."
    },
    detail: {
      emptyTitle: "Select a session",
      emptyDescription: "Choose a saved session or create a new one to see the round timeline.",
      noRounds: "No rounds have been generated yet.",
      waitingForRounds: "The run started, but the first message has not been saved yet.",
      round: "Round",
      live: "Live updates"
    },
    decision: {
      title: "Decision Board",
      description: "Review the latest decision, TODO list, and exports from the selected session.",
      rerun: "Rerun",
      stop: "Stop",
      markdown: "Markdown",
      json: "JSON",
      empty: "No final decision yet.",
      topRecommendation: "Top Recommendation",
      finalSummary: "Final Summary",
      todo: "TODO",
      status: "Status",
      updated: "Updated",
      metrics: {
        title: "Activity Metrics",
        mcpCalls: "MCP Calls",
        skillUses: "Skill Uses",
        webSearches: "Web Searches",
        tokens: "Tokens",
        duration: "Duration"
      }
    },
    decisionSections: {
      alternatives: "Alternatives",
      risks: "Risks",
      assumptions: "Assumptions",
      openQuestions: "Open Questions",
      nextActions: "Next Actions"
    },
    roundStages: {
      opening: "Opinion",
      rebuttal: "Rebuttal",
      summary: "Moderator Summary",
      final: "Final Recommendation"
    },
    messageKinds: {
      opinion: "Opinion",
      rebuttal: "Rebuttal",
      summary: "Summary",
      final: "Final"
    },
    todoPriorities: {
      high: "High",
      medium: "Medium",
      low: "Low"
    },
    statuses: {
      draft: "Draft",
      queued: "Queued",
      running: "Running",
      stopped: "Stopped",
      completed: "Completed",
      failed: "Failed"
    },
    languages: {
      ko: { label: "Korean", description: "Generate the debate and final decision in Korean." },
      en: { label: "English", description: "Generate the debate and final decision in English." },
      ja: { label: "Japanese", description: "Generate the debate and final decision in Japanese." }
    }
  },
  ja: {
    appBadge: "Ship Council MVP",
    headerTitle: "パネル討論をリアルタイムで進めて結論まで整理します",
    headerDescription:
      "プロバイダー接続は OpenCode に任せ、セッションではテーマとプリセットだけを設定します。実行が始まると各ラウンドが順に表示されます。",
    uiLanguageLabel: "UI 言語",
    noProvider: "プロバイダーなし",
    noAuthMode: "認証方式なし",
    noModel: "モデルなし",
    errorFallback: "リクエストを処理できませんでした。",
    refreshing: "更新中...",
    connection: {
      title: "接続設定",
      description: "OpenCode でプロバイダー、ログイン方式、モデルを管理します。",
      provider: "プロバイダー",
      loginMethod: "ログイン方式",
      model: "モデル",
      authDescriptionFallback: "このプロバイダーの認証方式を選択してください。",
      modelDescriptionFallback: "新しいセッションで使うモデルを選択してください。",
      status: "OpenCode 状態",
      connected: "接続済み",
      notConnected: "未接続",
      connectedDescription: "このプロバイダーはすでに OpenCode credential store に接続されています。",
      notConnectedDescription: "このプロバイダーに接続された OpenCode 認証情報がありません。",
      apiKey: "API キー",
      apiPlaceholder: "API キーを入力してください",
      apiHelp:
        "接続を保存すると API キーが OpenCode credential store に保存されます。すでに OpenCode に接続されていれば空でも構いません。",
      openLogin: "ログインを開く",
      disconnect: "切断",
      oauthConnectedDescription: "このプロバイダーはすでに接続されています。アカウントを切り替える場合は切断してください。",
      oauthStartDescription: "OpenCode がブラウザのログイン画面を開き、認証情報は OpenCode 側に保存されます。",
      oauthProgress: "OpenCode ログイン進行中",
      oauthCodePlaceholder: "ログイン後に返されたコードを貼り付けてください",
      oauthComplete: "ログイン完了",
      oauthAutoDescription: "ブラウザログインを完了すると、このカードは自動で更新されます。",
      oauthFallbackHint: "状態が変わらない場合は、別のログイン方法を試すか接続状態を再確認してください。",
      save: "接続を保存",
      savedAt: "最終保存"
    },
    session: {
      title: "新しいセッション",
      description: "テーマ、プリセット、言語、反復回数だけを設定します。保存済みの OpenCode 接続をそのまま再利用します。",
      activeConnection: "現在の接続",
      providerNotSaved: "プロバイダー未保存",
      loginNotSaved: "ログイン未保存",
      modelNotSaved: "モデル未保存",
      connectHint: "新しいセッションを始める前に OpenCode 接続を保存するかログインしてください。",
      dirtyHint: "接続設定が変わりました。先に保存してください。",
      titleLabel: "タイトル",
      titlePlaceholder: "任意",
      topicLabel: "テーマ",
      topicPlaceholder: "プリセットに議論させたい意思決定テーマを入力してください。",
      presetLabel: "プリセット",
      customPresetTitle: "カスタムプリセット生成",
      customPresetDescription: "欲しい視点とエージェント数を指定すると、AI が新しいプリセットを組み立てます。",
      customPresetPromptLabel: "プリセット指示",
      customPresetPromptPlaceholder: "例: AI リサーチ補助の立ち上げを検討するため、顧客、運用、価格、実装、懐疑派の視点がほしい。",
      customPresetAgentCountLabel: "エージェント数",
      generatePreset: "AI でプリセット生成",
      generatedPresetBadge: "AI 生成",
      languageLabel: "セッション言語",
      webSearchLabel: "ウェブ検索",
      webSearchHint: "必要なときだけウェブ検索ツールを使って最新情報を確認します。",
      debateIntensityLabel: "反復回数",
      debateIntensityHint: "意見 -> 反論のサイクルを何回繰り返すかを決めます。",
      selectedPreset: "選択したプリセット",
      create: "セッションを作成して実行",
      languageSummaryPrefix: "言語",
      debateSummaryPrefix: "反復回数"
    },
    sessions: {
      title: "セッション一覧",
      description: "保存済みセッションを確認し、再実行できます。",
      empty: "まだセッションがありません。"
    },
    detail: {
      emptyTitle: "セッションを選択してください",
      emptyDescription: "保存済みセッションを選ぶか、新しいセッションを作成すると討論タイムラインが表示されます。",
      noRounds: "まだラウンドが生成されていません。",
      waitingForRounds: "実行は開始されましたが、最初のメッセージはまだ保存されていません。",
      round: "ラウンド",
      live: "リアルタイム更新中"
    },
    decision: {
      title: "決定ボード",
      description: "最終結論、TODO、エクスポートを確認します。",
      rerun: "再実行",
      stop: "停止",
      markdown: "Markdown",
      json: "JSON",
      empty: "まだ最終結論がありません。",
      topRecommendation: "最優先提案",
      finalSummary: "最終要約",
      todo: "TODO",
      status: "状態",
      updated: "更新",
      metrics: {
        title: "実行指標",
        mcpCalls: "MCP 呼び出し",
        skillUses: "スキル使用",
        webSearches: "ウェブ検索",
        tokens: "トークン",
        duration: "所要時間"
      }
    },
    decisionSections: {
      alternatives: "代替案",
      risks: "リスク",
      assumptions: "前提",
      openQuestions: "未解決の質問",
      nextActions: "次のアクション"
    },
    roundStages: {
      opening: "意見",
      rebuttal: "反論",
      summary: "モデレーター要約",
      final: "最終提案"
    },
    messageKinds: {
      opinion: "意見",
      rebuttal: "反論",
      summary: "要約",
      final: "最終"
    },
    todoPriorities: {
      high: "高",
      medium: "中",
      low: "低"
    },
    statuses: {
      draft: "下書き",
      queued: "待機中",
      running: "実行中",
      stopped: "停止済み",
      completed: "完了",
      failed: "失敗"
    },
    languages: {
      ko: { label: "韓国語", description: "議論と最終結論を韓国語で生成します。" },
      en: { label: "英語", description: "議論と最終結論を英語で生成します。" },
      ja: { label: "日本語", description: "議論と最終結論を日本語で生成します。" }
    }
  }
} as const;

export function getPreferredUiLocale(): UiLocale {
  if (typeof navigator === "undefined") {
    return "ko";
  }

  const language = navigator.language.toLowerCase();
  if (language.startsWith("ko")) {
    return "ko";
  }
  if (language.startsWith("ja")) {
    return "ja";
  }

  return "en";
}

export function isUiLocale(value: string | null | undefined): value is UiLocale {
  return value === "ko" || value === "en" || value === "ja";
}

export function getUiCopy(locale: UiLocale) {
  return COPY[locale] ?? COPY.en;
}

export function formatUiTimestamp(value: string, locale: UiLocale): string {
  try {
    return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function getUiLanguageLabel(language: SessionLanguage, locale: UiLocale): string {
  return getUiCopy(locale).languages[language].label;
}

export function getDebateIntensityLabel(intensity: DebateIntensity, locale: UiLocale): string {
  const count = Math.max(1, Math.trunc(Number(intensity) || 1));

  switch (locale) {
    case "ko":
      return `${count}회 반복`;
    case "ja":
      return `${count}回反復`;
    default:
      return `${count} cycles`;
  }
}

export function getDebateIntensityDescription(intensity: DebateIntensity, locale: UiLocale): string {
  const count = Math.max(1, Math.trunc(Number(intensity) || 1));

  switch (locale) {
    case "ko":
      return `의견과 반박을 ${count}번 반복한 뒤 모더레이터 요약과 최종 결론을 만듭니다.`;
    case "ja":
      return `意見と反論を ${count} 回繰り返したあと、モデレーター要約と最終結論を生成します。`;
    default:
      return `Run ${count} opinion -> rebuttal cycles before the moderator summary and final decision.`;
  }
}

export function getDecisionSectionLabel(key: DecisionSectionKey, locale: UiLocale): string {
  return getUiCopy(locale).decisionSections[key];
}

export function getStatusLabel(status: string, locale: UiLocale): string {
  const copy = getUiCopy(locale);
  if (status in copy.statuses) {
    return copy.statuses[status as keyof typeof copy.statuses];
  }

  return status;
}

export function getRoundStageLabel(stage: string, locale: UiLocale): string {
  const copy = getUiCopy(locale);
  if (stage in copy.roundStages) {
    return copy.roundStages[stage as keyof typeof copy.roundStages];
  }

  return stage;
}

export function getMessageKindLabel(kind: string, locale: UiLocale): string {
  const copy = getUiCopy(locale);
  if (kind in copy.messageKinds) {
    return copy.messageKinds[kind as keyof typeof copy.messageKinds];
  }

  return kind;
}

export function getTodoPriorityLabel(priority: string, locale: UiLocale): string {
  const copy = getUiCopy(locale);
  if (priority in copy.todoPriorities) {
    return copy.todoPriorities[priority as keyof typeof copy.todoPriorities];
  }

  return priority;
}
