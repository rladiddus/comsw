import test from "node:test";
import assert from "node:assert/strict";
import { as, freshDb } from "./pg.mjs";

test("AI는 전체 계정 합산 월 3,000원 넘는 예약을 차단, 성공 사용량으로 정산", async () => {
  const db = await freshDb();
  try {
    const a =
      (await db.query("select comsw_reserve_ai('a','profile','one',2000) as r"))
        .rows[0].r;
    await assert.rejects(
      db.query("select comsw_reserve_ai('b','profile','two',2000)"),
      /예산/,
    );
    await db.query("select comsw_finish_ai($1,300,'{}','{}',false)", [a.id]);
    await db.query("select comsw_reserve_ai('b','profile','two',2000)");
    await as(db, "authenticated", { sub: "a", comsw_role: "teacher" });
    const budget = (await db.query("select comsw_ai_budget() as b")).rows[0].b;
    assert.equal(budget.used, 2300);
    assert.equal(budget.remaining, 700);
    await assert.rejects(
      db.query("select comsw_reserve_ai('a','week','cheat',1)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("변경 없는 요약은 비용 없이 재사용, 불확실한 실패는 예약 유지", async () => {
  const db = await freshDb();
  try {
    const a =
      (await db.query("select comsw_reserve_ai('a','week','hash',100) as r"))
        .rows[0].r;
    await db.query(
      `select comsw_finish_ai($1,2,'{"text":"요약"}','{}',false)`,
      [a.id],
    );
    const cached =
      (await db.query("select comsw_reserve_ai('a','week','hash',100) as r"))
        .rows[0].r;
    assert.equal(cached.cached, true);
    assert.equal(cached.result.text, "요약");
    const b =
      (await db.query("select comsw_reserve_ai('a','week','other',100) as r"))
        .rows[0].r;
    await db.query("select comsw_finish_ai($1,0,'{}','{}',true)", [b.id]);
    assert.equal(
      (await db.query(
        "select sum(budget_krw)::int as total from comsw_ai_jobs",
      )).rows[0].total,
      102,
    );
  } finally {
    await db.close();
  }
});
