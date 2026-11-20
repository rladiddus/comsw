// 20261120010000: AI 사용 기록에 'common'(V4 과목 공통 요약) 허용, 모르는 종류는 계속 막음.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./pg.mjs";

test("AI 사용 기록: common 허용, 모르는 종류는 막음", async () => {
  const db = await freshDb();
  await db.query(`insert into comsw_ai_jobs(owner_uid, kind, cache_key, month, budget_krw) values ('u', 'common', 'k', '2026-11', 10)`);
  await assert.rejects(db.query(`insert into comsw_ai_jobs(owner_uid, kind, cache_key, month, budget_krw) values ('u', 'x', 'k', '2026-11', 10)`), /kind_check/);
});
