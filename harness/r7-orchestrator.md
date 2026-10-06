# R7 — 지휘자 절차와 보호 장치

1. `HANDOFF.md`, 규칙, 문서, 현재 상태를 읽고 다음 미완료 단계를 결정합니다.
2. P1 → P2 → G1 → P3 → G2 → G3 → P4 순서를 지킵니다. 각 게이트 뒤 `state.json`에 결과, 현재 `rules_sha256`, 증거 경로를 기록합니다. 실패하면 연속 실패 수를 올리고, 통과하면 0으로 초기화합니다. 통과 증거를 확인하기 전에 다음 설계 단계로 넘어가지 않습니다.
3. `rules.yaml` 변경은 사람 승인과 `.rules-unlock`이 있을 때만 합니다. 편집 후 사람은 잠금 파일을 제거합니다.
4. 세 번 연속 실패하면 멈춥니다. G3 승인을 대신 추정하거나 자동으로 기록하지 않습니다.
5. G1/G2는 Figma 안에서 덤프·평가 번들을 실행하고 제한된 요약을 확인합니다. Figma 호출 순서는 아래 "Figma 최소 호출 런북"을 따릅니다.
6. G3 승인 뒤 P4 프로토타입을 만들고, 헤드리스 Chrome의 데스크톱·360px 캡처를 Figma와 대조해 결함 표를 완료합니다.
7. 작업이 끝나면 `HANDOFF.md`의 현재 상태와 다음 액션을 갱신합니다.

`.claude/settings.json`은 규칙 파일 변경과 단계 밖 Figma·Artifact 작업을 훅으로 막습니다. 훅은 승인이나 프로젝트 소유자의 결정을 대신하지 않습니다. 훅은 이 폴더가 Claude Code 프로젝트 루트일 때만 작동합니다. 앱 저장소의 하위 폴더(예: `design-harness/`)에 복사하면 훅이 로드되지 않으므로, 단계 규칙을 직접 지키거나 앱 저장소의 `.claude/settings.json`에 이 폴더 경로로 훅을 등록합니다.

## Figma 최소 호출 런북

Figma MCP 호출은 느리고 요금제 한도가 있습니다. 그래서 Figma에서 실행할 코드는 **세션 전에 모두 파일로 만들고**, 세션에서는 파일을 그대로 붙여넣기만 합니다. MoreWin은 손으로 만들 때 35회를 썼고, 같은 결과를 이 방식으로 5~6회에 낼 수 있었습니다.

### 0. 시작 전 확인 (MCP 호출 0회)

저장소 루트에서 실행합니다. 모두 통과해야 Figma를 엽니다.

```bash
node tools/check-sync.mjs                        # 문서와 규칙 일치
(cd tools && npm test)                           # 도구 테스트
node tools/figma-scripts/generate.mjs            # figma/build-*.js, figma/ai-prompts.md 생성
node tools/figma-scripts/mock-run.mjs            # 가짜 Figma로 끝까지 실행 + 모의 G1/G2
node tools/build-figma-gate.mjs --gate G1 && node tools/build-figma-gate.mjs --gate G2
```

`mock-run`은 오타, 없는 변수·컴포넌트, 변수에 묶이지 않은 값, FILL/HUG 오용을 미리 잡습니다. 크기 계산과 렌더링은 하지 않으므로 **게이트 증거가 아닙니다**. 증거는 실제 G1/G2 번들 결과뿐입니다.

### 1. 호출 순서 (새 Figma 파일, 5회)

| # | 단계 | 도구 | 붙여넣을 것 |
| --- | --- | --- | --- |
| 1 | P2 | `create_new_file` | 파일 이름, 팀 planKey (planKey를 알면 `whoami`는 쓰지 않습니다) |
| — | — | (MCP 아님) | 사람 승인 + `.rules-unlock` → `rules.yaml`의 `figma.file_url` 기록 → 잠금 해제 파일 삭제 → 생성기와 게이트 번들을 **다시** 만듭니다 (규칙 해시가 바뀌기 때문) |
| 2 | P2 | `use_figma` | `figma/build-system.js` 전체 |
| 3 | G1 | `use_figma` | `tools/dist/figma-gate-G1.js` 전체 → `runs/<id>/G1.json`, `state.json` 기록 |
| 4 | P3 | `use_figma` | `figma/build-screens.js` 전체 |
| 5 | G2 | `use_figma` | `tools/dist/figma-gate-G2.js` 전체 → `runs/<id>/G2.json`, `state.json` 기록 |

- 이미 만든 파일을 다시 쓰면 3·5번만 실행합니다 (2회).
- G3 검토에 화면 이미지가 필요하면 `get_screenshot`을 Screens 페이지 전체에 1회만 씁니다. P4 시각 비교도 이 이미지를 다시 씁니다.
- 생성된 스크립트는 같은 것을 두 번 만들지 않습니다. 변수나 화면이 이미 있으면 아무것도 바꾸지 않고 오류를 냅니다.

### 2. 실패했을 때

| 상황 | 할 일 | 게이트 실패 수에 넣나 |
| --- | --- | --- |
| `use_figma` 스크립트 오류 | Figma는 아무것도 바꾸지 않습니다. 오류를 읽고 `figma/src/*.js`를 고친 뒤 생성 → 모의 실행 → 다시 붙여넣기 | 아니오 |
| 네트워크 끊김 | 같은 호출을 한 번 다시 보냅니다 | 아니오 |
| 스크립트가 무거워 시간 초과 | 컴포넌트를 `figma/src/components.js`로 옮기면 별도 호출이 됩니다 (+1회) | 아니오 |
| 서체 로드 실패 | `figma/config.json`의 `font.family`를 Figma에 있는 서체로 바꾸고 다시 생성합니다. 한글은 Noto Sans KR이 있었습니다 (2026-10) | 아니오 |
| 게이트 FAIL | 결과의 `node_ids`로 원인을 찾습니다. 읽기 전용 진단 `use_figma`는 1회까지 씁니다 | 예 |
| 같은 게이트 3회 연속 FAIL | 멈추고 증거와 원인을 보고합니다 | — |

### 3. Figma AI는 게이트 밖에서만

Figma AI가 만든 결과는 보통 변수에 묶이지 않은 값과 인스턴스가 아닌 레이어로 나옵니다. 그래서 G1·G2에서 떨어집니다. AI 결과는 `AI Drafts` 같은 별도 페이지에만 둡니다. 화면 방향을 여러 개 비교할 때 씁니다. 고른 안은 `docs/`와 `figma/src/*.js`로 옮긴 뒤 스크립트로 다시 만듭니다.

공통 머리말(색·간격·모서리·글자·터치 크기)은 `figma/ai-prompts.md`에 생성됩니다. 화면별 지시는 `figma/prompts/<화면 id>.md`에 쓰면 같은 파일에 합쳐집니다. Figma AI 기능의 정확한 이름, 요금제별 사용 가능 여부, 크레딧 비용은 확인하지 않았습니다. 세션 전에 사용하는 요금제에서 확인합니다.
