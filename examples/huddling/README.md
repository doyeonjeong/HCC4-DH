# HCC4-DH — 허들링 디자인 하네스

허들링 PRD를 기준으로 MVP 흐름을 정리하고, UI Bowl 레퍼런스와 Figma 화면을 만들며, 기계 판정 게이트로 결과를 확인하는 실습용 Codex 하네스입니다.

## 이번 PoC 결과

- 흐름: 무료 학습자료 → 스킬 상세 → 월간 미션 제출
- 화면: `library_home`, `skill_detail`, `mission_submit` (각 390×844)
- Figma: [허들링 앱 MVP · 학습·미션 PoC](https://www.figma.com/design/DF7XZVnPQqcqobaKgPJy98)
- UI Bowl: 플랭 학습 메인, 말해보카 도전 과제 레퍼런스 2개
- 구매·결제·정산·마켓 기능은 이번 화면 명세에서 제외

## 하네스 구성

| 층 | 파일 | 역할 |
|---|---|---|
| 기준 문서 | `docs/prd.md`, `docs/design.md`, `docs/story-service.md`, `docs/story-work.md` | 제품·디자인 맥락과 확인된 수작업 기준 |
| 규칙 | `rules.yaml`, `defaults.yaml` | 게이트 기준 SSOT와 이번 실행의 기본 흐름 |
| 작업자 | `.codex/agents/*.toml` | 역할별 범위가 제한된 Codex 에이전트 |
| 실행 안내 | `AGENTS.md`, `.agents/skills/run-harness/SKILL.md` | 오케스트레이터 규칙과 재사용 가능한 실행 절차 |
| 판정 | `harness/scripts/`, `harness/guides/` | 화면 명세·토큰·UI Bowl·Figma 프레임 검사 |
| 실행 기록 | `runs/huddling-mvp-poc/` | 입력, 진행 상태, 판정, 승인 기록 |

`gate-judge` 에이전트는 읽기 전용입니다. R1-B에 해당하는 AI 없는 과거 수작업 순서는 확인되지 않아, 하네스가 그 이력을 재현한다고 주장하지 않습니다.

## 빠른 확인

필요한 것은 Node.js뿐이며 외부 패키지 설치는 없습니다.

```bash
npm test
npm run verify
```

검증 결과는 `runs/huddling-mvp-poc/gate-results.json`에 저장됩니다. 현재 입력 해시가 바뀌면 이전 시안 승인은 무효입니다. 시안을 확인한 사람이 `approval.md`에 `APPROVED: yes`, 승인자, 시각, 그리고 판정 결과의 `input_sha256` 값을 기록한 뒤 아래 명령으로 G5 승인을 저장합니다.

```bash
node harness/scripts/save-blocks.mjs --run huddling-mvp-poc --gate G5 --status pass
node harness/scripts/verify.mjs --run huddling-mvp-poc
```

## 새 실행과 재개

1. `defaults.yaml`을 바탕으로 새 `runs/<slug>/` 입력과 상태 파일을 만듭니다.
2. `AGENTS.md`와 `.agents/skills/run-harness/SKILL.md` 순서로 작업하고, 단계마다 검증합니다.
3. Figma MCP에서 실제 화면 정보를 다시 읽어 `figma/metadata.xml`에 저장한 뒤 내보냅니다.

```bash
node harness/scripts/figma-export-figma.js --run <slug>
node harness/scripts/verify.mjs --run <slug>
node harness/scripts/save-blocks.mjs --run <slug> --gate G7 --status pass
```

## 상태와 제출

이번 실행의 기계 게이트는 통과했습니다. `gate-results.json`의 `human_approval_pending`은 사람의 시안 확인을 기다린다는 뜻이며, 자동으로 Public 제출을 허용하지 않습니다. Figma 링크 공개, Git commit/push, 과제 제출은 결과를 확인한 사용자가 직접 진행합니다.
