// '+ 개월 추가': 원래 과목 이름 + 숫자로 다음 달 과목을 만들고 같은 학과에 연결(승인 전 신규 과목).
// 선생님은 본인 담당 과목에서만, 번호는 '지금 가장 큰 번호 + 1'만 새로 만들 수 있다.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };
const HEAD = { sub: "head", role: "authenticated", comsw_role: "head" };

// 웹툰1(학과 연결) + 선생님 t1이 웹툰1 담당
async function setup({ teach = true } = {}) {
  const db = await seeded();
  await as(db, null);
  const { rows: [d] } = await db.query(`select id from departments limit 1`);
  const { rows: [s] } = await db.query(`insert into subjects(name, duration, sort_order) values ('웹툰1', '1개월', 99) returning id`);
  await db.query(`insert into subject_departments values ($1, $2)`, [s.id, d.id]);
  const { rows: [i] } = await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1') returning id`);
  if (teach) await db.query(`insert into instructor_subjects(instructor_id, subject_id) values ($1, $2)`, [i.id, s.id]);
  return { db, subjectId: s.id, deptId: d.id };
}

test("다음 달 과목은 원래 과목의 학과에 순서 없이 생기고, 같은 이름이면 그 과목을 돌려준다", async () => {
  const { db, subjectId, deptId } = await setup();
  await as(db, "authenticated", TEACHER);
  const { rows: [{ id }] } = await db.query(`select comsw_create_month_subject($1, '웹툰2') id`, [subjectId]);
  const { rows: [{ id: again }] } = await db.query(`select comsw_create_month_subject($1, '웹툰2') id`, [subjectId]);
  assert.equal(again, id);
  await as(db, null);
  const { rows: [made] } = await db.query(`select name, duration, sort_order from subjects where id = $1`, [id]);
  assert.deepEqual(made, { name: "웹툰2", duration: "1개월", sort_order: null });
  const { rows: links } = await db.query(`select department_id from subject_departments where subject_id = $1`, [id]);
  assert.deepEqual(links.map((l) => l.department_id), [deptId]);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_create_month_subject($1, '포토샵2')`, [subjectId]), /숫자만/);
  await as(db, "anon");
  await assert.rejects(db.query(`select comsw_create_month_subject($1, '웹툰3')`, [subjectId]));
});

test("선생님은 본인 담당 과목에서만 만들 수 있고, 학과장은 모든 과목에서 만들 수 있다", async () => {
  const { db, subjectId } = await setup({ teach: false });
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_create_month_subject($1, '웹툰2')`, [subjectId]), /담당 과목/);
  await as(db, "authenticated", HEAD);
  const { rows: [{ id }] } = await db.query(`select comsw_create_month_subject($1, '웹툰2') id`, [subjectId]);
  assert.ok(id);
});

test("번호는 지금 가장 큰 번호 + 1만 새로 만들 수 있다(건너뛰기·임의 번호 막기)", async () => {
  const { db, subjectId } = await setup();
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_create_month_subject($1, '웹툰999')`, [subjectId]), /웹툰2/);
  await assert.rejects(db.query(`select comsw_create_month_subject($1, '웹툰3')`, [subjectId]), /웹툰2/);
  await db.query(`select comsw_create_month_subject($1, '웹툰2')`, [subjectId]);
  const { rows: [{ id }] } = await db.query(`select comsw_create_month_subject($1, '웹툰3') id`, [subjectId]);
  assert.ok(id, "2가 생긴 뒤에는 3");
});

test("과목 이름에 괄호 같은 특수문자가 있어도 다음 달 과목을 만든다", async () => {
  const db = await seeded();
  await as(db, null);
  const { rows: [s] } = await db.query(`insert into subjects(name) values ('AI(기초) 1') returning id`);
  await as(db, "authenticated", HEAD);
  const { rows: [{ id }] } = await db.query(`select comsw_create_month_subject($1, 'AI(기초) 2') id`, [s.id]);
  assert.ok(id);
  await assert.rejects(db.query(`select comsw_create_month_subject($1, 'AI(기초)x')`, [s.id]), /숫자만/);
});
