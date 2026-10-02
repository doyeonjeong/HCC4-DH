const clean = (value) => String(value ?? "").replace(/[`*]/g, "").trim();
const cellsFrom = (line) => line.trim().slice(1, -1).split("|").map(clean);

function parseNumber(value) {
  const match = String(value ?? "").match(/^(-?\d+(?:\.\d+)?)\s*(?:px)?$/i);
  return match ? Number(match[1]) : undefined;
}

function parseTypography(value) {
  const match = String(value ?? "").match(/^(\d+(?:\.\d+)?)\s*px?\s*\/\s*(\d+(?:\.\d+)?)\s*px?\s*\/\s*(\d+)$/i);
  return match ? match.slice(1).map(Number) : undefined;
}

function equalValue(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export function checkSync(markdown, rules, preset) {
  const differences = [];
  const rows = markdown.split("\n")
    .filter((line) => line.trim().startsWith("|") && !/^\s*\|?\s*:?-{3,}/.test(line))
    .map(cellsFrom)
    .filter((cells) => cells.length >= 3);
  const actual = { colors: new Map(), spacing: new Map(), radii: new Map(), typography: new Map() };
  for (const [category, name, value] of rows) {
    if (category === "color") actual.colors.set(name, value.toUpperCase());
    if (category === "spacing") actual.spacing.set(name, parseNumber(value));
    if (category === "radius") actual.radii.set(name, parseNumber(value));
    if (category === "typography") actual.typography.set(name, parseTypography(value));
  }

  const compareMap = (category, expected, found, transform = (value) => value) => {
    for (const [name, value] of Object.entries(expected ?? {})) {
      const got = found.get(name);
      const wanted = transform(value);
      if (!equalValue(got, wanted)) differences.push(`${category}.${name}: 문서 ${JSON.stringify(got ?? "문서에 없음")} / 규칙 ${JSON.stringify(wanted)}`);
    }
    for (const name of found.keys()) {
      if (!Object.hasOwn(expected ?? {}, name)) differences.push(`${category}.${name}: 등록되지 않은 토큰`);
    }
  };

  compareMap("tokens.colors", rules.tokens?.colors, actual.colors, (value) => String(value).toUpperCase());
  compareMap("tokens.spacing", rules.tokens?.spacing, actual.spacing, Number);
  compareMap("tokens.radii", rules.tokens?.radii, actual.radii, Number);
  compareMap("tokens.typography", rules.tokens?.typography, actual.typography, (value) => value.map(Number));

  const presetReference = "presets/{rules.preset}.yaml";
  if (!markdown.includes(presetReference)) differences.push(`preset: 문서에 ${presetReference} 참조가 없음`);
  if (preset?.name !== rules.preset) differences.push(`preset: rules.yaml의 ${rules.preset}과 프리셋 ${preset?.name ?? "누락"}이 다름`);
  if (!markdown.includes("safe_area.top") || !markdown.includes("target.minimum_size")) {
    differences.push("preset: safe area와 minimum target 크기는 선택한 프리셋을 참조해야 함");
  }
  if (!markdown.includes(String(rules.tokens?.safe_area?.variable ?? ""))
    || !markdown.includes(String(rules.tokens?.safe_area?.bind_to ?? ""))) {
    differences.push("tokens.safe_area: 문서의 변수와 바인딩 속성이 rules.yaml과 다름");
  }

  const componentLimit = markdown.match(/개수 상한[^\n]*컴포넌트\s*`?(\d+)`?\s*개/);
  const variantLimit = markdown.match(/변형 축[^\n]*`?(\d+)`?\s*개\s*이하/);
  const maxComponents = Number(rules.components?.max_count);
  const maxVariantAxes = Number(rules.components?.max_variant_axes);
  if (rules.gates?.G1?.checks?.component_count_max !== maxComponents) {
    differences.push("components.max_count와 gates.G1.checks.component_count_max 값이 다름");
  }
  if (rules.gates?.G1?.checks?.variant_axes_max !== maxVariantAxes) {
    differences.push("components.max_variant_axes와 gates.G1.checks.variant_axes_max 값이 다름");
  }
  if (Number(componentLimit?.[1]) !== maxComponents) differences.push("components.max_count: 문서의 개수 상한이 다름");
  if (Number(variantLimit?.[1]) !== maxVariantAxes) differences.push("components.max_variant_axes: 문서의 변형 축 상한이 다름");

  return differences;
}
