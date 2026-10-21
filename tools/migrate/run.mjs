// 사용법: node tools/migrate/run.mjs --out <파일> [--raw <raw_*.json 폴더>]
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transform } from "./transform.mjs";
import { toSql } from "./to-sql.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function isInsideRepo(outPath, repoRoot) {
  const rel = path.relative(path.resolve(repoRoot), path.resolve(outPath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function readRawFolder(dir) {
  return fs.readdirSync(dir).filter(f => /^raw_\d+\.json$/.test(f)).sort()
    .flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
}

export async function fetchRawRows() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(REPO_ROOT, "assets/js/supabase-config.js"), "utf8"), { window });
  const { url, anonKey } = window.COMSW_SUPABASE_CONFIG;
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/raw_sheet_rows?select=source_id,sheet_name,row_number,data&order=id.asc`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`raw_sheet_rows HTTP ${res.status}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const out = arg("--out");
  if (!out) {
    console.error("사용법: node tools/migrate/run.mjs --out <파일> [--raw <폴더>]");
    process.exit(2);
  }
  if (isInsideRepo(out, REPO_ROOT)) {
    console.error("저장소 안에는 개인정보가 담긴 데이터 SQL을 쓸 수 없습니다");
    process.exit(1);
  }
  const raw = arg("--raw") ? readRawFolder(arg("--raw")) : await fetchRawRows();
  const model = transform(raw);
  fs.writeFileSync(out, toSql(model));
  console.log(`원본 ${raw.length}행 → ${out}`);
  for (const w of model.warnings) console.log(`경고: ${w}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
