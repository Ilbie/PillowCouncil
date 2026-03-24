import { getRoundStageLabel, type UiLocale } from "@/lib/i18n";

export function getSessionSectionDescription(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "주제, 프리셋, 모델, 언어, 토론 반복 횟수, 생각 강도를 정한 뒤 바로 실행합니다.";
    case "ja":
      return "テーマ、プリセット、モデル、言語、討論回数、思考強度を設定してすぐ実行します。";
    default:
      return "Set the topic, preset, model, language, debate cycles, and thinking intensity, then run immediately.";
  }
}

export function getDecisionSectionDescription(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "최종 결론과 핵심 리스크만 남깁니다.";
    case "ja":
      return "最終結論と主要リスクだけを表示します。";
    default:
      return "Keep only the final decision and the key risks.";
  }
}

export function getActivityMetricsTitle(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "활동 지표";
    case "ja":
      return "アクティビティ指標";
    default:
      return "Activity Metrics";
  }
}

export function getActivityMetricLabel(
  metric: "mcp" | "skills" | "webSearch" | "inputTokens" | "outputTokens" | "workTime",
  locale: UiLocale
): string {
  switch (metric) {
    case "mcp":
      switch (locale) {
        case "ko": return "MCP 호출";
        case "ja": return "MCP 呼び出し";
        default: return "MCP Calls";
      }
    case "skills":
      switch (locale) {
        case "ko": return "스킬 사용";
        case "ja": return "スキル使用";
        default: return "Skills Used";
      }
    case "webSearch":
      switch (locale) {
        case "ko": return "웹 검색";
        case "ja": return "Web 検索";
        default: return "Web Searches";
      }
    case "inputTokens":
      switch (locale) {
        case "ko": return "입력 토큰";
        case "ja": return "入力トークン";
        default: return "Input Tokens";
      }
    case "outputTokens":
      switch (locale) {
        case "ko": return "출력 토큰";
        case "ja": return "出力トークン";
        default: return "Output Tokens";
      }
    default:
      switch (locale) {
        case "ko": return "작업 시간";
        case "ja": return "作業時間";
        default: return "Work Time";
      }
  }
}

export function getSessionModelLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "세션 모델";
    case "ja":
      return "セッションモデル";
    default:
      return "Session model";
  }
}

export function getSessionModelHint(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "저장된 공급사 기준으로 이번 세션에서 사용할 모델을 고릅니다.";
    case "ja":
      return "保存したプロバイダーの中から今回のセッションで使うモデルを選びます。";
    default:
      return "Choose which model to use for this session under the saved provider.";
  }
}

export function getThinkingFieldLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "생각 강도";
    case "ja":
      return "思考強度";
    default:
      return "Thinking intensity";
  }
}

export function getThinkingFieldHint(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "한 번의 발언에서 얼마나 깊게 검토할지 정합니다.";
    case "ja":
      return "各発言でどれだけ深く考えるかを決めます。";
    default:
      return "Controls how deeply each response should reason before answering.";
  }
}

export function getPresetStudioShortcutDescription(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "커스텀 프리셋 생성은 설정의 프리셋 스튜디오에서 관리합니다.";
    case "ja":
      return "カスタムプリセット生成は設定内のプリセットスタジオで管理します。";
    default:
      return "Custom preset generation now lives in Preset Studio inside settings.";
  }
}

export function getOpenPresetStudioLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "프리셋 스튜디오 열기";
    case "ja":
      return "プリセットスタジオを開く";
    default:
      return "Open Preset Studio";
  }
}

export function getReturnToSessionLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "세션으로 돌아가기";
    case "ja":
      return "セッションに戻る";
    default:
      return "Back to session";
  }
}

export function getCloseLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "닫기";
    case "ja":
      return "閉じる";
    default:
      return "Close";
  }
}

export function getStructuredOutputReadyLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "구조화 출력 지원";
    case "ja":
      return "構造化出力に対応";
    default:
      return "Structured output ready";
  }
}

export function getRiskSectionLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "리스크";
    case "ja":
      return "リスク";
    default:
      return "Risks";
  }
}

export function getLiveWorkspaceLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "라이브 워룸";
    case "ja":
      return "ライブ討論ルーム";
    default:
      return "Live War Room";
  }
}

export function getLiveWorkspaceDescription(locale: UiLocale, isRunning: boolean): string {
  switch (locale) {
    case "ko":
      return isRunning
        ? "라운드가 생기기 전에도 현재 단계, 최근 발언, 패널 진행도를 실시간으로 추적합니다."
        : "선택한 세션의 토론 진행도와 패널 활동을 한눈에 확인합니다.";
    case "ja":
      return isRunning
        ? "ラウンドが作成される前でも、現在の段階、最新発言、パネル進行度を追跡します。"
        : "選択したセッションの討論進行とパネル活動をひと目で確認します。";
    default:
      return isRunning
        ? "Track the current stage, latest update, and panel momentum even before the first round lands."
        : "See the debate progress and panel activity for the selected session at a glance.";
  }
}

export function getScrumBoardLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "스크럼 단계";
    case "ja":
      return "スクラム段階";
    default:
      return "Scrum Stages";
  }
}

export function getActivityFeedLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "실시간 피드";
    case "ja":
      return "ライブフィード";
    default:
      return "Live Feed";
  }
}

export function getAgentBoardLabel(locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return "패널 활동";
    case "ja":
      return "パネル活動";
    default:
      return "Panel Activity";
  }
}

export function getProgressMetricLabel(metric: "expected" | "completed" | "stage" | "speaker", locale: UiLocale): string {
  switch (metric) {
    case "expected":
      switch (locale) {
        case "ko": return "예정 라운드";
        case "ja": return "予定ラウンド";
        default: return "Planned Rounds";
      }
    case "completed":
      switch (locale) {
        case "ko": return "완료 라운드";
        case "ja": return "完了ラウンド";
        default: return "Completed";
      }
    case "stage":
      switch (locale) {
        case "ko": return "현재 단계";
        case "ja": return "現在の段階";
        default: return "Current Stage";
      }
    default:
      switch (locale) {
        case "ko": return "최근 발언";
        case "ja": return "最新発言";
        default: return "Latest Speaker";
      }
  }
}

export function getStageStatusLabel(status: "pending" | "active" | "completed", locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return status === "active" ? "진행 중" : status === "completed" ? "완료" : "대기";
    case "ja":
      return status === "active" ? "進行中" : status === "completed" ? "完了" : "待機";
    default:
      return status === "active" ? "Active" : status === "completed" ? "Done" : "Pending";
  }
}

export function getAgentStatusLabel(status: "queued" | "active" | "done", locale: UiLocale): string {
  switch (locale) {
    case "ko":
      return status === "active" ? "발언 차례" : status === "done" ? "발언 완료" : "대기";
    case "ja":
      return status === "active" ? "発言中" : status === "done" ? "完了" : "待機";
    default:
      return status === "active" ? "Speaking" : status === "done" ? "Done" : "Queued";
  }
}

export function getSpeakerProgressLabel(current: number, total: number, locale: UiLocale): string {
  switch (locale) {
    case "ko": return `${current}/${total}명 발언`;
    case "ja": return `${current}/${total}人が発言`;
    default: return `${current}/${total} speakers`;
  }
}

export function getContributionLabel(count: number, locale: UiLocale): string {
  switch (locale) {
    case "ko": return `${count}개 메시지`;
    case "ja": return `${count}件の発言`;
    default: return `${count} messages`;
  }
}

export function getWaitingFeedLabel(locale: UiLocale, stage: string | null): string {
  const stageLabel = stage ? getRoundStageLabel(stage, locale) : null;

  switch (locale) {
    case "ko":
      return stageLabel ? `${stageLabel} 단계 응답을 기다리는 중입니다.` : "첫 응답을 기다리는 중입니다.";
    case "ja":
      return stageLabel ? `${stageLabel} 段階の応答を待っています。` : "最初の応答を待っています。";
    default:
      return stageLabel ? `Waiting for ${stageLabel} responses.` : "Waiting for the first response.";
  }
}
