import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadProjectConfig } from "./lib/config.mjs";
import { evaluateGate } from "./lib/gates/evaluate.js";

const toolsRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsRoot, "..");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!["--gate", "--dump", "--out"].includes(flag)) throw new TypeError(`unknown option: ${flag}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new TypeError(`missing value for ${flag}`);
    if (options[flag] !== undefined) throw new TypeError(`duplicate option: ${flag}`);
    options[flag] = value;
    index += 1;
  }
  if (!(["G1", "G2"].includes(options["--gate"]))) throw new TypeError("--gate must be G1 or G2");
  for (const flag of ["--dump", "--out"]) if (!options[flag]) throw new TypeError(`missing value for ${flag}`);
  return { gate: options["--gate"], dumpPath: resolve(projectRoot, options["--dump"]), outPath: resolve(projectRoot, options["--out"]) };
}

async function canonicalPath(path) {
  let current = resolve(path);
  const suffix = [];
  while (true) {
    try {
      return resolve(await realpath(current), ...suffix);
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
      const parent = dirname(current);
      if (parent === current) return resolve(current, ...suffix);
      suffix.unshift(basename(current));
      current = parent;
    }
  }
}

async function safeRunOutput(path) {
  const runsRoot = await canonicalPath(resolve(projectRoot, "runs"));
  const target = await canonicalPath(path);
  const relativePath = relative(runsRoot, target);
  if (!relativePath || relativePath === "." || relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || relativePath === ".." || resolve(relativePath) === relativePath) {
    throw new TypeError("--out must be a file inside runs/");
  }
  return target;
}

export async function runGate({ gate, dumpPath, outPath }) {
  const outputPath = await safeRunOutput(outPath);
  const [{ rules, rulesText, preset, presetText }, dumpBytes] = await Promise.all([
    loadProjectConfig(projectRoot),
    readFile(dumpPath),
  ]);
  let dump;
  try {
    dump = JSON.parse(dumpBytes.toString("utf8"));
  } catch (error) {
    throw new SyntaxError(`invalid dump JSON: ${error.message}`);
  }
  const result = {
    ...evaluateGate(dump, rules, preset, gate),
    rules_sha256: sha256(rulesText),
    preset_sha256: sha256(presetText),
    dump_sha256: sha256(dumpBytes),
    checked_at: new Date().toISOString(),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  const failed = Object.entries(result.checks).filter(([, check]) => !check.pass).map(([name]) => name);
  return { result, summary: `${gate} ${result.pass ? "PASS" : "FAIL"}: ${result.node_count} nodes, ${Object.keys(result.checks).length} checks${failed.length ? `; failed: ${failed.join(", ")}` : ""}` };
}

async function main() {
  const { summary, result } = await runGate(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${summary}\n`);
  if (!result.pass) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
