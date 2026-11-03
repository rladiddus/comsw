// 학과 과목이면 수업 설정에서 고르지 않아도 선생님이 제출(20261103010000). 내 학과가 아닌 과목은 막음.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };
const step = { step_label: "1단계", written: "원문", media_url: "" };

test("내 학과 과목은 담당 과목이 아니어도 제출, 다른 학과 과목은 막는다", async () => {
  const db = await seeded();
  await as(db, null);
  const { rows: [d1, d2] } = await db.query(`select id from departments order by sort_order limit 2`);
  const { rows: [set] } = await db.query(`select id from curriculum_sets limit 1`);
  const { rows: [mine] } = await db.query(`insert into subjects(name, sort_order) values ('새학과과목', 951) returning id`);
  const { rows: [other] } = await db.query(`insert into subjects(name, sort_order) values ('남의과목', 952) returning id`);
  await db.query(`insert into subject_departments values ($1, $2), ($3, $4)`, [mine.id, d1.id, other.id, d2.id]);
  const { rows: [i] } = await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1') returning id`);
  await db.query(`insert into instructor_departments(instructor_id, department_id) values ($1, $2)`, [i.id, d1.id]);
  await as(db, "authenticated", TEACHER);
  const submit = (id) => db.query(`select comsw_submit_curriculum($1, false, $2::jsonb, null) n`, [set.id, JSON.stringify([{ subject_id: id, steps: [step] }])]);
  assert.equal((await submit(mine.id)).rows[0].n, 1);
  await assert.rejects(submit(other.id), /내 학과의 과목만/);
});
