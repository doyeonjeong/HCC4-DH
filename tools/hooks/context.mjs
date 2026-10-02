import { access, lstat, readFile, realpath } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { createHash } from "node:crypto";

export async function readHookInput() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new TypeError("훅 입력 JSON을 읽을 수 없습니다.");
  }
}

export async function findHarnessRoot(start) {
  let current = resolve(start || process.cwd());
  while (true) {
    try {
      await Promise.all([access(resolve(current, "rules.yaml")), access(resolve(current, "state.json"))]);
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}

export async function canonicalPath(path) {
  let current = resolve(path);
  const suffix = [];
  while (true) {
    try {
      return resolve(await realpath(current), ...suffix);
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
      const parent = dirname(current);
      if (parent === current) return resolve(current, ...suffix);
      suffix.unshift(current.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
      current = parent;
    }
  }
}

export async function readState(root) {
  const [stateText, rulesText] = await Promise.all([
    readFile(resolve(root, "state.json"), "utf8"),
    readFile(resolve(root, "rules.yaml"), "utf8"),
  ]);
  let state;
  try {
    state = JSON.parse(stateText);
  } catch {
    throw new TypeError("state.json을 읽을 수 없어 안전하게 진행할 수 없습니다.");
  }
  return { state, rulesText, rulesSha256: createHash("sha256").update(rulesText).digest("hex") };
}

export async function unlockExists(root) {
  try {
    const details = await lstat(resolve(root, ".rules-unlock"));
    return details.isFile() && !details.isSymbolicLink();
  } catch {
    return false;
  }
}

export function block(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
}
