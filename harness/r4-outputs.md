# R4 — 산출물과 재개 규칙

## 단계별 산출물

| 단계 | 산출물 경로 | 설명 |
|---|---|---|
| 기준 문서 | `docs/prd.md`, `docs/design.md`, `docs/story-service.md`, `docs/story-work.md` | 제품 요구사항, 디자인 규칙, 서비스 사용자, 수작업 기준 상태 |
| 규칙 | `rules.yaml` | 게이트·필수 산출물·MVP 금지 항목의 단일 SSOT |
| 기본값 | `defaults.yaml` | 이번 PoC 기본 흐름, 화면 목록, 도구 선택 |
| 레퍼런스 | `runs/<slug>/references/uibowl.json`, `notes.md` | UI Bowl 검색 결과 링크와 관찰 노트 |
| 키스크린 | `runs/<slug>/key-screens/manifest.json` | 화면 목적, 연결 사용자 스토리, 필요한 상태 |
| 토큰 | `runs/<slug>/tokens/tokens.json` | `docs/design.md`에서 추출한 화면 토큰 |
| Figma | `runs/<slug>/figma/manifest.json`, `screenshots/` | Figma 파일·프레임 ID, 화면 캡처, 시안 선택 |
| 판정 | `runs/<slug>/gate-results.json` | 게이트별 pass/fail, 실패 사유, 복귀 단계 |
| 실행 상태 | `runs/<slug>/state.json` | 마지막 완료 단계, 현재 게이트, 산출물 버전 |
| 사람 승인 | `runs/<slug>/approval.md`, `approval.json` | 사람이 승인 내용을 기록하고 오케스트레이터가 입력 지문에 바인딩 |

## 규칙 SSOT

`rules.yaml`만 게이트 조건과 금지 범위를 정의한다. `defaults.yaml`, 에이전트 프롬프트, 가이드는 규칙을 복제하지 않고 이 파일의 키를 참조한다.

## 재개

- 재개 가능: 예.
- 각 단계 완료 시 `state.json`의 `last_pass`, 산출물 경로, 체크섬을 갱신한다.
- `이어서 해줘`는 `last_pass` 다음 단계부터 실행한다.
- 기존 산출물을 덮어쓰지 않고 실행별 `runs/<slug>/` 아래에 보존한다.
- PRD나 디자인 규칙이 바뀌면 이전 실행을 수정하지 않고 새 slug로 시작한다.

## 현재 연결 자산

- Figma 파일: [허들링 앱 MVP · 학습·미션 PoC](https://www.figma.com/design/DF7XZVnPQqcqobaKgPJy98)
- UI Bowl은 화면 레퍼런스 조회용이며 화면 생성·업로드 도구로 취급하지 않는다.
