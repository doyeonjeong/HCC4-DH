# HCC4-DH Codex Design Harness

## 기준 문서

- 제품 요구사항: `docs/prd.md`
- 디자인 규칙: `docs/design.md`
- 서비스 스토리와 불변 조건: `docs/story-service.md`
- 수작업 기준 상태: `docs/story-work.md`
- 게이트 SSOT: `rules.yaml`
- 기본 흐름/출력: `defaults.yaml`

R1-B에서 AI 없이 수행한 과거 흐름은 확인되지 않았다. 새 하네스 흐름을 과거 이력으로 표현하지 않는다.

## 기본 PoC

`무료 학습자료 목록 → 스킬/프롬프트 상세 → 월간 미션 제출`의 세 화면을 Figma에 만든다. 구매·결제·정산·판매 중·마켓은 MVP 화면에서 제외한다.

## 실행 규칙

- `/run-harness` 스킬을 사용해 규칙 순서대로 진행한다.
- Codex 작업자는 `.codex/agents/*.toml`에 정의하고 각자 지정된 실행 산출물 폴더만 편집한다.
- `gate-judge`는 읽기 전용이다. 판정 결과에 게이트 ID, 근거, 실패 시 복귀 단계를 남긴다.
- 매 게이트 뒤 `runs/<slug>/state.json`에 진행 상태를 기록한다. 재개 시 `last_pass` 다음 단계부터 시작한다.
- Figma MCP 쓰기는 순차 실행한다. 실제 프레임은 Figma MCP에서 다시 읽어 확인한다.
- UI Bowl은 출시된 화면을 찾는 읽기 전용 레퍼런스로 사용한다.
- Public 제출은 산출물과 판정표를 준비한 뒤 도연의 구체 승인을 기다린다.

## 검증

- 판정: `node harness/scripts/verify.mjs --run huddling-mvp-poc`
- 판정 테스트: `node --test harness/tests/*.test.mjs`
