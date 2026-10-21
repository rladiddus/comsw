// 사용법: node tools/migrate/roundtrip.mjs --raw <raw_*.json 폴더> [--live]
// 원본 시트와 "적용" 스냅샷을 공개 사이트가 읽는 방식으로 비교한다. 차이가 있으면 종료 코드 1.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { transform } from "./transform.mjs";
import { toSql } from "./to-sql.mjs";
import { readRawFolder } from "./run.mjs";
import { siteViews } from "./views.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const IC_HELPER_TAB = "전체학과별 과목";

function rawGetter(raw) {
  return (source, name) => raw
    .filter(r => r.source_id === source && r.sheet_name === name)
    .sort((a, b) => a.row_number - b.row_number)
    .map(r => r.data?.values || []);
}

async function snapshotRowsLocal(raw) {
  const { freshDb } = await import("../test/pg.mjs");
  const db = await freshDb();
  await db.exec(toSql(transform(raw)));
  await db.query("select comsw_publish_as_owner()");
  return async (source, name) =>
    (await db.query("select data from comsw_site_rows($1, $2)", [source, name])).rows.map(r => r.data.values || []);
}

function snapshotRowsLive() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(REPO_ROOT, "assets/js/supabase-config.js"), "utf8"), { window });
  const { url, anonKey } = window.COMSW_SUPABASE_CONFIG;
  return async (source, name) => {
    const res = await fetch(`${url}/rest/v1/rpc/comsw_site_rows`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_source: source, p_sheet: name }),
    });
    if (!res.ok) throw new Error(`comsw_site_rows HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()).map(r => r.data.values || []);
  };
}

// siteViews는 동기 함수라, 필요한 시트를 먼저 모두 읽어 둔다.
async function prefetch(fetchSheet, sheets) {
  const cache = {};
  for (const [source, name] of sheets) cache[`${source}/${name}`] = await fetchSheet(source, name);
  return (source, name) => cache[`${source}/${name}`] ?? [];
}

export function diffViews(a, b, prefix = "") {
  if (isDeepStrictEqual(a, b)) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [`${prefix}: 개수 ${a.length} → ${b.length}`];
    return a.flatMap((x, i) => diffViews(x, b[i], `${prefix}[${i}]`));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap(k => diffViews(a[k], b[k], prefix ? `${prefix}.${k}` : k));
  }
  return [`${prefix}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
}

async function main() {
  const i = process.argv.indexOf("--raw");
  if (i < 0) {
    console.error("사용법: node tools/migrate/roundtrip.mjs --raw <폴더> [--live]");
    process.exit(2);
  }
  const raw = readRawFolder(process.argv[i + 1]);
  const tabsOf = source => [...new Set(raw.filter(r => r.source_id === source).map(r => r.sheet_name))];
  const tabs = {
    instructor_curriculum: tabsOf("instructor_curriculum").filter(t => t !== IC_HELPER_TAB),
    recruitment: tabsOf("recruitment"),
  };
  const sheets = [
    ...["메인 페이지", "로딩 중", "컴수원_전체수업", "로드맵", "수업별 준비물(AI/교재 등)", "수업별 준비몰(AI/교재 등)", "강사페이지", "특강 및 세미나"]
      .map(n => ["main", n]),
    ...tabs.instructor_curriculum.map(n => ["instructor_curriculum", n]),
    ...tabs.recruitment.map(n => ["recruitment", n]),
  ];
  const fetchSnapshot = process.argv.includes("--live") ? snapshotRowsLive() : await snapshotRowsLocal(raw);
  const before = siteViews(rawGetter(raw), tabs);
  const after = siteViews(await prefetch(fetchSnapshot, sheets), tabs);
  const diffs = diffViews(before, after);
  if (!diffs.length) {
    console.log("차이 없음");
    return;
  }
  console.log(`차이 ${diffs.length}건:`);
  for (const d of diffs.slice(0, 200)) console.log(`  ${d}`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
