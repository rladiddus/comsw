// V4 학과 추가·학과명 수정(20261119070000): 새 학과 + 같은 이름 학과 탭, 이름 수정은 탭도 함께, 같은 이름 막음, 선생님 불가.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };

test("학과 추가·이름 수정은 바로 공개, 학과 탭도 함께", async () => {
  const db = await freshDb();
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const { rows: [{ v }] } = await db.query(`select comsw_v4_save_department(null, ' 게임학과 ') v`);
  await as(db, null);
  assert.equal((await db.query(`select name from curriculum_sets where department_id = $1`, [v])).rows[0].name, "게임학과");
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_v4_save_department(null, '게임학과')`), /같은 이름/);
  await db.query(`select comsw_v4_save_department($1, '게임개발학과')`, [v]);
  await as(db, null);
  assert.equal((await db.query(`select name from curriculum_sets where department_id = $1`, [v])).rows[0].name, "게임개발학과");
  const snap = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  assert.ok(snap.some((r) => r.sheet_name === "컴수원_전체수업" && r.data.values[14] === "게임개발학과"), "바로 공개");
  await as(db, "authenticated", { sub: "t", comsw_role: "teacher" });
  await assert.rejects(db.query(`select comsw_v4_save_department(null, '몰래학과')`), /권한/);
});
