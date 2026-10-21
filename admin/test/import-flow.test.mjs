import test from "node:test";
import assert from "node:assert/strict";
import { importFromSheets, fetchRawRows } from "../js/import-flow.mjs";
import { SAMPLE_ROWS } from "../../tools/test/fixtures.mjs";
import { transform } from "../../tools/migrate/transform.mjs";

const fakeRpc = result => {
  const calls = [];
  return { calls, rpc: async (name, args) => { calls.push([name, args]); return result; } };
};

test("시트 원본을 변환해 comsw_import로 넘기고 개수·경고를 돌려준다", async () => {
  const supabase = fakeRpc({ data: { subjects: 2 }, error: null });
  const out = await importFromSheets({ fetchRaw: async () => SAMPLE_ROWS, supabase });
  const [[name, { payload }]] = supabase.calls;
  assert.equal(name, "comsw_import");
  assert.equal(payload.subjects.length, transform(SAMPLE_ROWS).subjects.length);
  assert.deepEqual(out.counts, { subjects: 2 });
  assert.deepEqual(out.warnings, transform(SAMPLE_ROWS).warnings);
});

test("원본이 비었으면 가져오지 않는다", async () => {
  const supabase = fakeRpc({ data: {}, error: null });
  await assert.rejects(importFromSheets({ fetchRaw: async () => [], supabase }), /시트 원본이 비어 있습니다/);
  assert.equal(supabase.calls.length, 0);
});

test("가져오기 오류는 throw", async () => {
  const supabase = fakeRpc({ data: null, error: { message: "가져오기 권한이 없습니다" } });
  await assert.rejects(importFromSheets({ fetchRaw: async () => SAMPLE_ROWS, supabase }), /가져오기 권한이 없습니다/);
});

test("원본은 1000행씩 끝까지 읽는다", async () => {
  const ranges = [];
  const fetchFn = async (_url, { headers }) => {
    ranges.push(headers.Range);
    const n = ranges.length === 1 ? 1000 : 3;
    return { ok: true, json: async () => Array(n).fill({}) };
  };
  const rows = await fetchRawRows({ url: "https://x", anonKey: "k" }, fetchFn);
  assert.equal(rows.length, 1003);
  assert.deepEqual(ranges, ["0-999", "1000-1999"]);
});
