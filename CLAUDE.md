# 디자인 하네스 실행 규칙

작업을 시작할 때 `HANDOFF.md`, `rules.yaml`, `state.json`, `docs/`, 그리고 `harness/r2-purpose.md`부터 `harness/r7-orchestrator.md`까지 읽습니다. Codex는 `AGENTS.md`에서도 같은 규칙을 읽습니다.

- 단계 순서: P1 → P2 → G1 → P3 → G2 → G3 → P4. 단계별 산출물과 통과 조건은 `harness/`가 기준입니다.
- 제품 사실은 `docs/`에서 가져오고, 수치 기준은 `rules.yaml`과 선택한 `presets/`에서 가져옵니다. 없는 사실을 만들어 채우지 않습니다.
- `rules.yaml` 변경은 사람의 승인 후 `.rules-unlock` 파일이 있을 때만 합니다. 작업이 끝나면 사람은 잠금 파일을 제거합니다.
- 같은 게이트가 연속 3회 실패하면 재시도하지 말고 멈춰 원인과 증거를 보고합니다.
- G1/G2는 Figma 안에서 번들로 덤프와 평가를 함께 실행합니다. 결과는 요약만 확인하고, Figma 응답은 20KB를 넘기지 않습니다.
- G3에서 사람 승인을 받기 전에는 결과를 공유·발행하지 않습니다.
- P4 뒤에는 반드시 헤드리스 Chrome으로 각 화면을 데스크톱 폭과 360px 폭에서 캡처하고 Figma와 비교해 결함 표를 작성합니다.

도구 명령은 `tools/README.md`, 상세 단계는 `harness/` 문서를 따릅니다.
