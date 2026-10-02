# R6 — 역할과 자연어 트리거

각 작업 에이전트는 지정된 폴더 하나만 편집한다. `gate-judge`는 전체 산출물을 읽기만 한다.

| 역할 | 책임 | 편집 폴더 |
|---|---|---|
| `ref-collector` | UI Bowl에서 학습·미션 화면 레퍼런스를 수집하고 출처·관찰 노트를 작성 | `runs/<slug>/references/` |
| `flow-planner` | PRD 사용자 스토리를 선택한 MVP 화면 흐름과 연결 | `runs/<slug>/scope/` |
| `key-screen-designer` | 사용자 흐름의 핵심 화면 3개와 필수 상태를 정의 | `runs/<slug>/key-screens/` |
| `system-builder` | `docs/design.md` 토큰을 화면 구현용 파일로 정규화 | `runs/<slug>/tokens/` |
| `screen-designer` | 승인된 명세를 Figma 프레임으로 만들고 링크·캡처 기록 | `runs/<slug>/figma/` 및 지정 Figma 파일 |
| `orchestrator` | 단계 실행, 재개 상태, G5 승인 기록 관리 | `runs/<slug>/runtime/` |
| `gate-judge` | SSOT 규칙으로 산출물을 판정하고 실패 단계·복귀 지점을 기록 | 읽기 전용 — 편집 폴더 없음 |

## 자연어 트리거

| 사용자가 말하면 | 실행 |
|---|---|
| `하네스 시작` | G1부터 G7까지 순서 실행. G5에서 승인 응답을 기다린다. |
| `이어서 해줘` | `runs/<slug>/state.json`의 `last_pass` 다음 단계부터 재개한다. |
| `레퍼런스 모아줘` | `ref-collector` 실행 후 G1 판정 |
| `키스크린 그려줘` | `key-screen-designer` 실행 후 G4 판정 |
| `토큰 만들어줘` | `system-builder` 실행 후 G6 판정 |
| `화면 디자인해줘` | `screen-designer` 실행 후 G7 판정 |
| `시안 확정: {안}` | 사람 결정은 `runs/<slug>/approval.md`에 기록하고, 입력 해시와 함께 `approval.json`에 바인딩한 뒤 G5 판정 |
| `검수해줘`, `게이트 돌려줘` | `gate-judge`가 현재 산출물에 해당하는 게이트를 읽기 전용으로 실행 |

## 실행 경계

- 에이전트는 자기 편집 폴더 밖의 파일을 수정하지 않는다.
- `gate-judge`는 산출물을 직접 고치지 않고 실패 조건과 복귀 단계만 반환한다.
- Figma 쓰기는 `screen-designer` 한 역할에서만 수행한다.
- UI Bowl은 출시 화면을 찾는 읽기 전용 레퍼런스 저장소로 사용한다.
