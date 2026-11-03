// 과목 그룹(20261103030000): 대표 과목 → 이름만 있는 그룹.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as, freshDb, runMigration } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };
const add = async (db, name) => (await db.query(`insert into subjects(name) values ($1) returning id`, [name])).rows[0].id;

test("그룹: 과목과 같은 이름 가능, 학과장만 만들고, 그룹을 지우면 과목은 남고 연결만 풀림", async () => {
  const db = await seeded();
  await as(db, null);
  const ps = await add(db, "시험 과목"), p1 = await add(db, "시험 과목1");
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`insert into subject_groups(name) values ('시험 과목')`));
  await as(db, "authenticated", HEAD);
  const { rows: [g] } = await db.query(`insert into subject_groups(name) values ('시험 과목') returning id`);
  await assert.rejects(db.query(`insert into subject_groups(name) values ('시험 과목')`), "그룹 이름은 하나만");
  await db.query(`update subjects set group_id = $1 where id in ($2, $3)`, [g.id, ps, p1]);
  await db.query(`delete from subject_groups where id = $1`, [g.id]);
  assert.deepEqual((await db.query(`select name, group_id from subjects where id in ($1, $2) order by name`, [ps, p1])).rows,
    [{ name: "시험 과목", group_id: null }, { name: "시험 과목1", group_id: null }]);
});

test("옮기기: 이미 묶은 대표 과목은 같은 이름 그룹이 되고, 대표·하위 과목이 모두 그 그룹에 들어간다", async () => {
  const db = await freshDb("20261103030000");
  const cad = await add(db, "캐드"), c1 = await add(db, "캐드1"), lone = await add(db, "외톨이");
  await db.query(`update subjects set parent_id = $1 where id = $2`, [cad, c1]);
  await runMigration(db, "20261103030000_subject_group_table.sql");
  const { rows } = await db.query(`select s.name, g.name g from subjects s left join subject_groups g on g.id = s.group_id where s.id in ($1, $2, $3) order by s.name`, [cad, c1, lone]);
  assert.deepEqual(rows, [{ name: "외톨이", g: null }, { name: "캐드", g: "캐드" }, { name: "캐드1", g: "캐드" }]);
});
