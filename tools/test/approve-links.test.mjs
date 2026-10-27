// 승인 때 학과 연결: 학과에 연결된 과목이면 커리큘럼을 낸 학과 탭의 학과에도 연결, 기타 과목은 그대로.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };

async function setup() {
  const db = await seeded();
  await as(db, null);
  const { rows: [d1] } = await db.query(`select id from departments order by sort_order limit 1`);
  const { rows: [d2] } = await db.query(`select id from departments order by sort_order offset 1 limit 1`);
  const { rows: [set2] } = await db.query(`insert into curriculum_sets(name, department_id) values ('학과2 탭', $1) returning id`, [d2.id]);
  const { rows: [i] } = await db.query(`select id from instructors limit 1`);
  return { db, d1: d1.id, d2: d2.id, set2: set2.id, instructorId: i.id };
}
const pendingFor = async (db, setId, instructorId, subjectId) =>
  (await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status)
    values ($1, $2, $3, '1단계', '원문', 'pending') returning id`, [setId, instructorId, subjectId])).rows[0].id;
const linksOf = async (db, subjectId) => {
  await as(db, null);
  return (await db.query(`select department_id from subject_departments where subject_id = $1`, [subjectId])).rows.map((r) => r.department_id);
};

test("다른 학과에만 있던 과목을 학과2 탭으로 승인하면 학과2에도 연결된다", async () => {
  const { db, d1, d2, set2, instructorId } = await setup();
  const { rows: [s] } = await db.query(`insert into subjects(name, sort_order) values ('웹툰2', 500) returning id`);
  await db.query(`insert into subject_departments values ($1, $2)`, [s.id, d1]);
  const id = await pendingFor(db, set2, instructorId, s.id);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_approve_curriculum($1)`, [id]);
  assert.deepEqual((await linksOf(db, s.id)).sort(), [d1, d2].sort());
});

test("학과가 없는 기타 과목은 승인해도 학과에 연결되지 않는다(전체수업에 안 올라감)", async () => {
  const { db, set2, instructorId } = await setup();
  const { rows: [s] } = await db.query(`insert into subjects(name) values ('기타예시') returning id`);
  const id = await pendingFor(db, set2, instructorId, s.id);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_approve_curriculum($1)`, [id]);
  assert.deepEqual(await linksOf(db, s.id), []);
  const { rows: [x] } = await db.query(`select sort_order from subjects where id = $1`, [s.id]);
  assert.equal(x.sort_order, null);
});
