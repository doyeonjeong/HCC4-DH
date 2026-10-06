# 작업 인계

## 현재 상태

- 이 저장소는 새 프로젝트에 복사해 사용하는 범용 디자인 하네스 템플릿입니다.
- 기본 프리셋은 `rules.yaml`의 `mobile`이며 `presets/mobile.yaml`과 `presets/web.yaml`을 제공합니다.
- 기존 Huddling PoC는 `examples/huddling/`에 보존합니다.
- 실행 단계는 P1 → P2 → G1 → P3 → G2 → G3 → P4입니다.
- 도구 테스트 39개, mobile 동기화 검사, G1/G2 번들 크기 검증을 통과했습니다. G2 번들은 17,157 bytes입니다.
- 실제 프로젝트의 Figma 흐름이나 화면은 아직 생성하지 않았습니다.
- 2026-10-06 `fix/learnings-questers-morewin` 브랜치: MoreWin·Questers 실제 실행에서 나온 수정 5건 반영(TextEncoder 없는 바이트 계산, 테스트 픽스처 분리, Figma 플러그인 도구 이름 훅, `safe-area/top`, 컴포넌트 세트 모서리 주의). 아직 main에 합치지 않았습니다.

## 다음 액션

1. 새 프로젝트의 제품 사실을 `docs/`에 기록합니다.
2. 사람 승인 후 `.rules-unlock`을 만들어 `rules.yaml`의 프로젝트 기준을 채우고, 편집을 마치면 잠금 파일을 제거합니다.
3. `tools/README.md`의 설치·검증 절차를 실행한 뒤 `AGENTS.md` 또는 `CLAUDE.md`를 따라 P1을 시작합니다.
