# R3 — 파이프라인과 단계별 기준

하네스는 5단계로 실행한다. 각 단계는 명시된 입력을 읽고 산출물을 남긴 뒤 해당 게이트를 통과해야 다음 단계로 간다.

| 단계 | 작업 | 입력 | 산출물 | 게이트 | 실패 시 복귀 |
|---|---|---|---|---|---|
| S1 범위 선택 | Huddling PRD MVP에서 한 사용자 흐름과 화면 3개를 선택 | `docs/prd.md`, `docs/story-service.md`, `rules.yaml` | `runs/<slug>/scope/flow.json` | G1: 서비스 불변 조건 및 MVP 범위 통과 | S1 |
| S2 레퍼런스 수집 | UI Bowl에서 교육·학습 흐름의 출시 화면을 찾아 근거를 기록 | `flow.json`, `docs/design.md` | `runs/<slug>/references/uibowl.json`, `notes.md` | G2: 관련 레퍼런스 2개 이상 | S2 |
| S3 핵심 화면 정의 | 선택 흐름을 화면별 목적·역할·필수 콘텐츠로 나눔 | `flow.json`, UI Bowl 레퍼런스 | `runs/<slug>/key-screens/manifest.json` | G3: 3개 화면과 사용자 스토리 연결 | S3 |
| S4 토큰 구성 | Huddling 디자인 문서의 토큰을 화면 작업용으로 정규화 | `docs/design.md`, 화면 manifest | `runs/<slug>/tokens/tokens.json` | G6: 색상·간격·모서리·서체 값 검사 | S4 |
| S5 Figma 화면 제작·검수 | 승인된 핵심 화면을 Figma에 만들고 구조·시각 검수 | 화면 manifest, tokens, G5 승인 기록 | `runs/<slug>/figma/figma.json`, 캡처, `gate-report.json` | G7: 필수 프레임·콘텐츠·불변 조건 통과 | S3, S4 또는 S5 — 실패 게이트에 따라 복귀 |

## 승인 대기와 복귀

- G4에서 키스크린 시안을 제안하고 G5에서 사람이 시안을 승인할 때까지 대기한다.
- PRD 범위가 바뀌면 S1부터 다시 실행하고, 그 뒤 단계의 산출물은 이전 버전으로 표시한다.
- 레퍼런스 부족은 S2, 사용자 스토리 누락은 S3, 토큰 위반은 S4, Figma 구조·시각 위반은 S5로 돌려보낸다.
- R1-B의 실제 수작업 기준 흐름은 확인되지 않았다. 이 파이프라인은 과거 방식의 재현이 아니라 새 작업을 위한 기본 설계다.
