# R7 — Codex 오케스트레이터 재확인

## Codex 구성

- 자동 로드되는 저장소 지침: `AGENTS.md`
- 프로젝트 작업자 설정: `.codex/agents/*.toml`
- 반복 가능한 명령/작업 흐름: `.agents/skills/run-harness/SKILL.md`
- 규칙 SSOT: `rules.yaml`
- 판정 스크립트: `harness/scripts/verify.mjs`

## 오케스트레이터 순서

1. `AGENTS.md`, `rules.yaml`, `defaults.yaml`, `runs/<slug>/state.json`을 읽는다.
2. 현재 단계에 지정된 Codex 작업자만 호출한다.
3. 작업자 편집 경로와 산출물 목록을 확인한다.
4. `verify.mjs`를 실행하고 `gate-judge` 결과를 읽기 전용으로 확인한다.
5. 통과 시 `save-blocks.mjs`로 상태를 갱신한다. 실패 시 판정표의 복귀 단계로 보낸다.
6. G5 사람 승인은 `runs/<slug>/approval.md`와 입력 지문이 일치할 때만 통과한다.
7. G7 이후 Public 제출 패킷을 준비하고, 실제 외부 공개는 도연의 구체 승인 뒤에 수행한다.

## 재개·승인 무효화

- 승인서에는 PRD, 디자인 문서, 서비스 스토리, 화면 명세의 SHA-256 지문을 저장한다.
- 입력 지문이 바뀌면 기존 승인은 무효다. 새 승인 전에는 후속 단계와 Public 제출을 막는다.
- 승인 상태와 `last_pass`는 `runs/<slug>/state.json`에 남긴다.
