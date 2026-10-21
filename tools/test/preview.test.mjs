import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };
const HEAD = { sub: "h", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "t", role: "authenticated", comsw_role: "teacher" };
const preview = (db, sheet) => db.query(`select * from comsw_preview_rows('main', $1)`, [sheet]);

test("관리자·학과장은 적용 전 내용을 시트 모양으로 미리 본다", async () => {
  const db = await seeded();
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  await as(db, null);
  await db.exec(`update menus set is_active = false where name = '전체 수업'`);
  for (const who of [ADMIN, HEAD]) {
    await as(db, "authenticated", who);
    const rows = (await preview(db, "메인 페이지")).rows;
    assert.equal(rows[0].row_number, 2);
    assert.equal(rows.find(r => r.data.values[4] === "전체 수업").data.values[5], "false");
  }
  await as(db, "anon");
  const live = (await db.query(`select * from comsw_site_rows('main', '메인 페이지')`)).rows;
  assert.equal(live.find(r => r.data.values[4] === "전체 수업").data.values[5], "true", "방문자는 적용된 내용 그대로");
});

test("선생님·등급 없는 사용자·익명은 미리 볼 수 없다", async () => {
  const db = await seeded();
  for (const claims of [TEACHER, { sub: "x", role: "authenticated" }]) {
    await as(db, "authenticated", claims);
    await assert.rejects(preview(db, "메인 페이지"), /미리보기 권한이 없습니다/);
  }
  await as(db, "anon");
  await assert.rejects(preview(db, "메인 페이지"));
});
