# PillowCouncil 문서

> GitHub 방문자와 기여자를 위한 한국어 개요 문서입니다.

## 요약

PillowCouncil은 로컬 환경에서 실행되는 멀티 에이전트 의사결정 워크스페이스입니다. 여러 AI 페르소나가 구조적으로 토론하고, 의견 충돌을 초기에 드러내며, 마지막에는 최종 권고안·리스크·대안·다음 액션까지 정리할 수 있도록 돕습니다.

## 왜 유용한가요?

- 일회성 AI 대화를 반복 가능한 의사결정 프로세스로 전환합니다.
- 첫 답변을 그대로 따르지 않고 상반된 관점을 비교할 수 있습니다.
- 세션, 프리셋, 설정을 SQLite 기반으로 로컬에 보존합니다.
- 별도 인증 저장소를 만들지 않고 OpenCode 연결을 재사용합니다.

## 제공 기능

- 의견, 반박, 요약, 최종 권고 단계로 구성된 구조화된 토론
- OpenCode 기반의 재사용 가능한 공급사·로그인·모델 설정
- **SaaS Founder**, **Product Scope**, **Architecture Review** 같은 기본 위원회 프리셋
- 기본 프리셋이 부족할 때 사용할 수 있는 AI 기반 커스텀 프리셋 생성
- 한국어, 영어, 일본어 출력 지원
- Markdown 및 JSON 내보내기 지원

## 사용 흐름

1. 공급사, 로그인 방식, 모델을 설정합니다.
2. OpenCode를 통해 연결을 저장합니다.
3. 주제, 프리셋, 언어, 토론 강도로 세션을 생성합니다.
4. 실행 중인 토론을 타임라인에서 확인합니다.
5. 최종 권고안을 검토하고 필요하면 내보냅니다.

## 로컬 런타임 구조

- 자격 증명은 OpenCode가 관리합니다.
- 앱 설정과 세션 기록은 PillowCouncil이 관리합니다.
- 앱 데이터는 `~/.pillow-council/` 아래에 저장됩니다.
- 기본 SQLite 경로는 `~/.pillow-council/data/pillow-council.db`입니다.

## 저장소 구조

```text
apps/web                 Next.js UI 및 API 라우트
packages/shared          데이터베이스, 스키마, 리포지토리, 공용 타입
packages/agents          기본 페르소나와 프리셋 생성
packages/providers       OpenCode 연동 계층
packages/orchestration   토론 실행 엔진
packages/exports         내보내기 포맷 유틸리티
```

## 명령어

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run test:e2e
npm run db:inspect
```

## 관련 문서

- [GitHub README](../../README.md)
- [문서 허브](../README.md)
- [English](../en/README.md)
- [日本語](../ja/README.md)
