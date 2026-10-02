# Design system

> Starter values are examples. Review them with the project owner, then keep this table in sync with `rules.yaml`.

## Selected preset

- Viewport: `presets/{rules.preset}.yaml`
- Safe area top: `presets/{rules.preset}.yaml` → `safe_area.top`
- Minimum target: `presets/{rules.preset}.yaml` → `target.minimum_size`

## Tokens

| Category | Token | Value |
| --- | --- | --- |
| color | canvas | #FFFFFF |
| color | surface | #F5F6F8 |
| color | text-primary | #17191C |
| color | text-secondary | #5E6672 |
| color | border | #D9DEE5 |
| color | primary | #315FE8 |
| spacing | xxs | 4px |
| spacing | xs | 8px |
| spacing | sm | 12px |
| spacing | md | 16px |
| spacing | lg | 24px |
| spacing | xl | 32px |
| spacing | 2xl | 48px |
| spacing | 3xl | 64px |
| radius | none | 0px |
| radius | sm | 8px |
| radius | md | 12px |
| radius | lg | 16px |
| radius | xl | 24px |
| radius | full | 9999px |
| typography | display | 32px/40px/700 |
| typography | heading | 24px/32px/700 |
| typography | body | 16px/24px/400 |
| typography | caption | 14px/20px/400 |
| safe-area | top | `tokens.safe_area.variable` → `paddingTop` |

## Layout guidance

- Page padding: TODO — Give a value in the selected spacing scale.
- Safe area: Bind the top frame's `paddingTop` to the `safe-area.top` variable when the selected preset defines a non-zero inset.
- Responsive behavior: TODO — Describe how content rearranges at narrower widths.

## Components

- Required components and limits are listed in `rules.yaml`.
- 개수 상한: 컴포넌트 `12`개
- 변형 축: `3`개 이하
- `Heading` is the default component for screen titles and section labels.
- Add project-specific states, variants, and interaction notes here.

## Accessibility

- Text contrast target: see `rules.yaml` → `gates.G2.checks.min_contrast`.
- Minimum target size: see `presets/{rules.preset}.yaml` → `target.minimum_size`.
