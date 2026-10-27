// 과목 승인 없이 바로 쓰기·과목 관리: 학과장 과목은 바로 맨 뒤, 선생님 개월 과목은 승인 전, 사용처 세기·지우기.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const HEAD = { sub: "head", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };

async function setup() {
  const db = await seeded();
  await as(db, null);
  const { rows: depts } = await db.query(`select id from departments order by sort_order limit 2`);
  const { rows: [s] } = await db.query(`insert into subjects(name, duration, sort_order) values ('웹툰1', '1개월', 99) returning id`);
  await db.query(`insert into subject_departments values ($1, $2)`, [s.id, depts[0].id]);
  const { rows: [i] } = await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1') returning id`);
  await db.query(`insert into instructor_subjects(instructor_id, subject_id) values ($1, $2)`, [i.id, s.id]);
  const { rows: [set] } = await db.query(`select id from curriculum_sets limit 1`);
  return { db, depts: depts.map((d) => d.id), webtoon: s.id, me: i.id, setId: set.id };
}
const orderOf = async (db, id) => {
  await as(db, null);
  return (await db.query(`select sort_order from subjects where id = $1`, [id])).rows[0]?.sort_order;
};
const maxOrder = async (db) => (await db.query(`select max(sort_order) m from subjects`)).rows[0].m;

test("학과장이 만든 과목은 바로 전체수업 맨 뒤, 잘못된 입력은 아무것도 안 남긴다", async () => {
  const { db, depts } = await setup();
  await as(db, "authenticated", HEAD);
  const { rows: [{ id }] } = await db.query(`select comsw_create_subject(' 블렌더 ', $1) id`, [[depts[0], depts[1], depts[0]]]);
  await as(db, null);
  assert.equal(await orderOf(db, id), await maxOrder(db));
  const { rows: links } = await db.query(`select count(*)::int n from subject_departments where subject_id = $1`, [id]);
  assert.equal(links[0].n, 2, "같은 학과는 한 번만");
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_create_subject('블렌더', $1)`, [[depts[0]]]), /같은 이름/);
  await assert.rejects(db.query(`select comsw_create_subject('새것', '{}')`), /학과를 하나 이상/);
  await assert.rejects(db.query(`select comsw_create_subject('새것', $1)`, [[depts[0], "00000000-0000-0000-0000-000000000000"]]), /학과를 다시/);
  await assert.rejects(db.query(`select comsw_create_subject('  ', $1)`, [[depts[0]]]), /과목명/);
  await as(db, null);
  assert.equal((await db.query(`select 1 from subjects where name = '새것'`)).rows.length, 0);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_create_subject('선생님과목', $1)`, [[depts[0]]]), /권한/);
});

test("+ 개월 추가: 학과장이 만들면 바로 맨 뒤, 선생님이 만들면 승인 전(순서 없음)", async () => {
  const { db, webtoon } = await setup();
  await as(db, "authenticated", TEACHER);
  const { rows: [{ id: t2 }] } = await db.query(`select comsw_create_month_subject($1, '웹툰2') id`, [webtoon]);
  assert.equal(await orderOf(db, t2), null);
  await as(db, "authenticated", HEAD);
  const { rows: [{ id: h3 }] } = await db.query(`select comsw_create_month_subject($1, '웹툰3') id`, [webtoon]);
  assert.equal(await orderOf(db, h3), await maxOrder(db));
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_create_month_subject($1, '웹툰2')`, [webtoon]);
  assert.equal(await orderOf(db, t2), null, "이미 있는 과목은 상태를 바꾸지 않음");
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_activate_subject($1)`, [t2]);
  assert.equal(await orderOf(db, t2), await maxOrder(db), "정리 필요에서 바로 넣기");
  await as(db, null);
  const { rows: [{ id: other }] } = await db.query(`insert into subjects(name) values ('기타예시') returning id`);
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_activate_subject($1)`, [other]), /기타 과목/);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_activate_subject($1)`, [t2]), /권한/);
});

test("사용처를 세고, 확인창에 보여 준 사용처 개수(p_seen)가 지금과 같을 때만 지운다", async () => {
  const { db, webtoon, me, setId } = await setup();
  await as(db, "authenticated", HEAD);
  const { rows: [{ id: empty }] } = await db.query(`select comsw_create_subject('빈과목', (select array[id] from departments order by sort_order limit 1)) id`);
  await as(db, null);
  await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status, vacation)
    values ($1, $2, $3, '1단계', '원문', 'pending', false), ($1, $2, $3, '2단계', '방특', 'approved', true)`, [setId, me, webtoon]);
  await db.query(`insert into instructor_subject_materials(instructor_id, subject_id, tools) values ($1, $2, 'x')`, [me, webtoon]);
  await as(db, "authenticated", HEAD);
  const { rows } = await db.query(`select * from comsw_subject_usage() where subject_id = any($1)`, [[webtoon, empty]]);
  const u = Object.fromEntries(rows.map((r) => [r.subject_id, r]));
  assert.deepEqual([u[webtoon].pending, u[webtoon].vacation, u[webtoon].approved, u[webtoon].instructors, u[webtoon].materials], [1, 1, 0, 1, 1]);
  assert.deepEqual([u[empty].departments, u[empty].weeks, u[empty].pending], [1, 0, 0]);
  await assert.rejects(db.query(`select comsw_delete_subjects($1, 0)`, [[webtoon, empty]]), /쓰는 곳이 바뀌었습니다/);
  const { rows: [{ n }] } = await db.query(`select comsw_delete_subjects($1, 0) n`, [[empty]]);
  assert.equal(n, 1);
  // 확인창 뒤에 새 커리큘럼이 들어오면(4 → 5) 거절, 아무것도 안 지움.
  await as(db, null);
  await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status, vacation)
    values ($1, $2, $3, '3단계', '새로 낸 것', 'pending', false)`, [setId, me, webtoon]);
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_delete_subjects($1, 4)`, [[webtoon]]), /쓰는 곳이 바뀌었습니다/);
  await as(db, null);
  assert.equal((await db.query(`select count(*)::int n from instructor_curricula where subject_id = $1`, [webtoon])).rows[0].n, 3);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_delete_subjects($1, 5)`, [[webtoon]]);
  await as(db, null);
  assert.equal((await db.query(`select 1 from instructor_curricula where subject_id = $1`, [webtoon])).rows.length, 0, "함께 지워짐");
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select * from comsw_subject_usage()`), /권한/);
  await assert.rejects(db.query(`select comsw_delete_subjects($1, 0)`, [[empty]]), /권한/);
});

test("방특 과목(is_vacation)은 선생님이 '방특'으로 낼 때만 수업 설정과 관계없이 낼 수 있다", async () => {
  const { db, setId } = await setup();
  await as(db, null);
  const { rows: [x] } = await db.query(`insert into subjects(name, is_vacation) values ('여름 코딩캠프', true) returning id`);
  const submit = (vacation) => db.query(`select comsw_submit_curriculum($1, $2, $3::jsonb)`,
    [setId, vacation, JSON.stringify([{ subject_id: x.id, steps: [{ step_label: "1단계", written: "캠프" }] }])]);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(submit(false), /수업 설정에서 고른 과목/, "방특이 아니면 막힘");
  await as(db, "authenticated", TEACHER);
  await submit(true);
  await as(db, null);
  assert.equal((await db.query(`select vacation from instructor_curricula where subject_id = $1`, [x.id])).rows[0].vacation, true);
});

test("선생님 제출은 수업 설정에서 고른 과목만(이미 낸 과목은 계속 고칠 수 있음)", async () => {
  const { db, webtoon, setId } = await setup();
  await as(db, null);
  const { rows: [x] } = await db.query(`insert into subjects(name) values ('남의과목') returning id`);
  const submit = (sid) => db.query(`select comsw_submit_curriculum($1, false, $2::jsonb)`,
    [setId, JSON.stringify([{ subject_id: sid, steps: [{ step_label: "1단계", written: "원문" }] }])]);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(submit(x.id), /수업 설정에서 고른 과목/);
  await as(db, "authenticated", TEACHER);
  await submit(webtoon);
  await as(db, null);
  await db.query(`delete from instructor_subjects where subject_id = $1`, [webtoon]);
  await as(db, "authenticated", TEACHER);
  await submit(webtoon);
});
