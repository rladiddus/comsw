// 내 커리큘럼 '과목명 동일'을 끄고 새 과목명으로 제출(20261030010000): 담당 과목의 학과에 순서 없이 새 과목, 이미 있는 이름은 막음.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };

async function setup({ teach = true } = {}) {
  const db = await seeded();
  await as(db, null);
  const { rows: [d] } = await db.query(`select id from departments limit 1`);
  const { rows: [set] } = await db.query(`select id from curriculum_sets limit 1`);
  const { rows: [s] } = await db.query(`insert into subjects(name, duration, sort_order) values ('웹툰1', '1개월', 950) returning id`);
  await db.query(`insert into subject_departments values ($1, $2)`, [s.id, d.id]);
  const { rows: [i] } = await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1') returning id`);
  if (teach) await db.query(`insert into instructor_subjects(instructor_id, subject_id) values ($1, $2)`, [i.id, s.id]);
  return { db, setId: set.id, subjectId: s.id, deptId: d.id };
}
const submit = (db, setId, subjects) =>
  db.query(`select comsw_submit_curriculum($1, false, $2::jsonb, null) n`, [setId, JSON.stringify(subjects)]);
const step = { step_label: "1단계", written: "새 과목 원문", media_url: "" };

test("새 과목명으로 제출하면 담당 과목의 학과에 순서 없이 새 과목이 생기고 그 과목으로 승인 대기", async () => {
  const { db, setId, subjectId, deptId } = await setup();
  await as(db, "authenticated", TEACHER);
  assert.equal((await submit(db, setId, [{ custom_name: " 웹툰 캐릭터 ", from: subjectId, steps: [step] }])).rows[0].n, 1);
  await as(db, null);
  const { rows: [n] } = await db.query(`select id, duration, sort_order from subjects where name = '웹툰 캐릭터'`);
  assert.equal(n.duration, "1개월");
  assert.equal(n.sort_order, null, "승인 전이라 순서 없음");
  assert.deepEqual((await db.query(`select department_id from subject_departments where subject_id = $1`, [n.id])).rows.map((r) => r.department_id), [deptId]);
  assert.equal((await db.query(`select count(*)::int c from instructor_curricula where subject_id = $1 and status = 'pending'`, [n.id])).rows[0].c, 1);
});

test("이미 있는 과목 이름·담당이 아닌 과목·직접 호출은 막는다", async () => {
  const { db, setId, subjectId } = await setup();
  await as(db, "authenticated", TEACHER);
  await assert.rejects(submit(db, setId, [{ custom_name: "웹툰1", from: subjectId, steps: [step] }]), /이미 있습니다/);
  await assert.rejects(db.query(`select comsw_create_teacher_subject($1, '직접')`, [subjectId]));
  const other = await setup({ teach: false });
  await as(other.db, "authenticated", TEACHER);
  await assert.rejects(submit(other.db, other.setId, [{ custom_name: "새것", from: other.subjectId, steps: [step] }]), /내 담당 과목에서만/);
});
