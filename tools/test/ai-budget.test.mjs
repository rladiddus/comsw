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

test("AI 한도: 처음 3,000원, 관리자만 바꾸고 바로 적용, 부족하면 금액을 알려 줌", async () => {
  const db = await freshDb();
  const reserve = (key, n) => db.query("select comsw_reserve_ai('a','profile',$1,$2) as r", [key, n]).then((r) => r.rows[0].r);
  const role = (r) => as(db, "authenticated", { sub: "u", role: "authenticated", comsw_role: r });
  try {
    await reserve("one", 2800);
    await assert.rejects(reserve("two", 500), /예산이 부족합니다\(한도 3,000원 · 사용 2,800원 · 이번 작업에 필요한 금액 500원\)/);
    for (const r of ["head", "teacher"]) {
      await role(r);
      await assert.rejects(db.query("select comsw_set_ai_limit(20000)"), /관리자만/);
      await assert.rejects(db.query("select month_krw from comsw_private.ai_limit"), /permission denied/);
    }
    await role("admin");
    await assert.rejects(db.query("select comsw_set_ai_limit(-1)"), /0원부터/);
    await db.query("select comsw_set_ai_limit(20000)");
    const b = (await db.query("select comsw_ai_budget() as b")).rows[0].b;
    assert.deepEqual([b.used, b.limit, b.remaining], [2800, 20000, 17200]);
    await as(db, null);
    await reserve("two", 500);
  } finally {
    await db.close();
  }
});
test("AI 사용액에서 빼기: 관리자만, 실패·10분 넘게 멈춘 작업만. 성공은 예약보다 더 들면 든 금액 그대로", async () => {
  const db = await freshDb();
  const reserve = (key) => db.query("select comsw_reserve_ai('a','profile',$1,500) as r", [key]).then((r) => r.rows[0].r.id);
  const row = (id) => db.query("select status, budget_krw from comsw_ai_jobs where id=$1", [id]).then((r) => [r.rows[0].status, r.rows[0].budget_krw]);
  const admin = () => as(db, "authenticated", { sub: "u", role: "authenticated", comsw_role: "admin" });
  try {
    const failed = await reserve("f"), running = await reserve("r"), old = await reserve("o"), done = await reserve("d");
    await db.query("select comsw_finish_ai($1,500,null,null,true)", [failed]);
    await db.query("select comsw_finish_ai($1,700,'{}','{}',false)", [done]);
    assert.deepEqual(await row(done), ["completed", 700]);
    await db.query("update comsw_ai_jobs set created_at = now() - interval '11 minutes' where id=$1", [old]);
    await as(db, "authenticated", { sub: "h", role: "authenticated", comsw_role: "head" });
    await assert.rejects(db.query("select comsw_release_ai($1)", [failed]), /관리자만/);
    await admin();
    for (const id of [running, done]) await assert.rejects(db.query("select comsw_release_ai($1)", [id]), /실패했거나 멈춘 작업만/);
    for (const id of [failed, old]) await db.query("select comsw_release_ai($1)", [id]);
    await as(db, null);
    assert.deepEqual([await row(failed), await row(old), await row(running)], [["failed", 0], ["failed", 0], ["reserved", 500]]);
  } finally {
    await db.close();
  }
});
