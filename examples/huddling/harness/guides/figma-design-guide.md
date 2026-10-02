# Figma 디자인 가이드

기준은 `docs/design.md`의 모바일 390×844, 모노크롬 팔레트, 8px 기반 간격, Pretendard 및 명시된 대체 글꼴이다. 화면은 동일한 네비게이션, 카드 간격, CTA 모양을 사용한다.

## 자동 판정 규칙

- 🚦 `FLOW-THREE-SCREENS`: `library_home`, `skill_detail`, `mission_submit` 프레임 3개가 있어야 한다.
- 🚦 `REF-TWO-SOURCES`: UI Bowl 출처 링크 2개 이상과 화면 관찰 노트를 남긴다.
- 🚦 `SVC-SELLER-ROLE`: 판매 신청 UI를 추가할 경우 actor는 seller여야 한다. 기본 PoC에는 판매 신청이 없다.
- 🚦 `SVC-MANUAL-REVIEW`: 운영자 체크리스트 수동 검수를 AI 1차 검수로 바꾸지 않는다.
- 🚦 `MVP-NO-MARKETPLACE`: 구매·결제·정산·마켓·판매 중·판매 중지 기능을 화면 명세에 추가하지 않는다.
- 🚦 `TOK-DESIGN-SYSTEM`: 화면 명세 토큰은 `rules.yaml` 허용값 안에 있어야 한다.
- 🚦 `FIGMA-FRAME-STATE`: 저장된 목록이 아니라 Figma MCP 실제 조회 결과로 프레임 ID·크기·이름을 확인한다.

## 레퍼런스 사용 원칙

UI Bowl은 출시된 화면을 관찰하는 읽기 전용 레퍼런스다. 흐름의 구성 원리만 참고하고, 특정 서비스의 화면·문구를 그대로 복제하지 않는다.
