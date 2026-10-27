// 학과장 메인 학과: 고른 학과 중 하나만, 적용하면 강사페이지 학과 칸이 메인 학과 하나.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "uid-t", role: "authenticated", comsw_role: "teacher" };

async function setup() {
  const db = await seeded();
  await as(db, null);
  const { rows: depts } = await db.query(`select id, name from departments order by sort_order limit 3`);
  const { rows: [h] } = await db.query(`insert into instructors(name, account_uid) values ('박학과장', 'uid-h') returning id`);
  for (const d of depts.slice(0, 2)) await db.query(`insert into instructor_departments values ($1, $2)`, [h.id, d.id]);
  await db.query(`insert into instructors(name, account_uid) values ('선생', 'uid-t')`);
  return { db, depts, head: h.id };
}
const deptCell = async (db, name) => {
  await as(db, null);
  const { rows: [{ rows }] } = await db.query(`select comsw_build_rows() rows`);
  return rows.find((r) => r.sheet_name === "강사페이지" && r.data.values[0] === name)?.data.values[1];
};

test("메인 학과를 고르면 적용 행의 학과 칸이 메인 학과 하나, 빼면 다시 모든 학과", async () => {
  const { db, depts, head } = await setup();
  const both = await deptCell(db, "박학과장");
  assert.ok(both.includes(depts[0].name) && both.includes(depts[1].name), "고르기 전엔 모든 학과");
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_set_my_main_department($1)`, [depts[1].id]);
  assert.equal(await deptCell(db, "박학과장"), depts[1].name);
  await db.query(`delete from instructor_departments where instructor_id = $1 and department_id = $2`, [head, depts[1].id]);
  assert.equal(await deptCell(db, "박학과장"), depts[0].name, "메인 학과를 수업 설정에서 빼면 남은 학과");
  assert.deepEqual(
    [(await deptCell(db, "김민주"))], ["시각편집학과"], "같은 이름 강사 둘은 그대로");
});

test("고른 학과가 아닌 학과는 메인으로 못 고르고, 선생님은 못 쓴다", async () => {
  const { db, depts } = await setup();
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_set_my_main_department($1)`, [depts[2].id]), /고른 학과 중/);
  await db.query(`select comsw_set_my_main_department(null)`);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_set_my_main_department($1)`, [depts[0].id]), /권한/);
});
