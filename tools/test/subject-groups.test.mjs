// 방학 특강 과목(20261103020000). 대표 과목은 20261103030000에서 그룹으로 바뀜(subject-group-table.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };
const add = async (db, name) => (await db.query(`insert into subjects(name) values ($1) returning id`, [name])).rows[0].id;

test("방학 특강에 넣어 둔 과목은 선생님이 '방특'으로 그 방학 특강에 낼 수 있다(선생님은 넣기 못함)", async () => {
  const db = await seeded();
  await as(db, null);
  const { rows: [vac] } = await db.query(`insert into curriculum_sets(name, is_vacation) values ('시험 여름방학특강', true) returning id`);
  const sid = await add(db, "여름 드로잉");
  await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1')`);
  const submit = () => db.query(`select comsw_submit_curriculum($1, true, $2::jsonb, null) n`, [vac.id, JSON.stringify([{ subject_id: sid, steps: [{ step_label: "1단계", written: "원문", media_url: "" }] }])]);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(submit(), /내 학과의 과목만/, "넣기 전에는 막힘");
  await assert.rejects(db.query(`insert into vacation_set_subjects values ($1, $2)`, [vac.id, sid]));
  await as(db, "authenticated", HEAD);
  await db.query(`insert into vacation_set_subjects values ($1, $2)`, [vac.id, sid]);
  await as(db, "authenticated", TEACHER);
  assert.equal((await submit()).rows[0].n, 1);
});
