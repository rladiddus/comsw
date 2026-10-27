// 제출(본인·대신)·개월 추가·개월 빼기 = 각각 DB 함수 한 번(전부 저장 또는 전부 취소).
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };
const HEAD = { sub: "head", role: "authenticated", comsw_role: "head" };

async function setup() {
  const db = await seeded();
  await as(db, null);
  const { rows: [d] } = await db.query(`select id from departments limit 1`);
  const { rows: [set] } = await db.query(`select id from curriculum_sets limit 1`);
  const { rows: [s] } = await db.query(`insert into subjects(name, sort_order) values ('웹툰1', 950) returning id`);
  await db.query(`insert into subject_departments values ($1, $2)`, [s.id, d.id]);
  const { rows: [i] } = await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1') returning id`);
  await db.query(`insert into instructor_subjects(instructor_id, subject_id) values ($1, $2)`, [i.id, s.id]);
  const { rows: [other] } = await db.query(`insert into instructors(name) values ('t2') returning id`);
  return { db, setId: set.id, subjectId: s.id, me: i.id, other: other.id };
}
const submit = (db, setId, subjects, instructor = null, vacation = false) =>
  db.query(`select comsw_submit_curriculum($1, $2, $3::jsonb, $4) n`, [setId, vacation, JSON.stringify(subjects), instructor]);
const rowsOf = async (db, instructor) => {
  await as(db, null);
  return (await db.query(`select s.name, c.step_label, c.written from instructor_curricula c join subjects s on s.id = c.subject_id
    where c.instructor_id = $1 and c.status = 'pending' order by s.name, c.step_label`, [instructor])).rows;
};

test("본인 제출: 새 달 과목 + 프로그램·준비물 + 단계를 한 번에, 같은 단계는 다시 내면 고침", async () => {
  const { db, setId, subjectId, me } = await setup();
  await as(db, "authenticated", TEACHER);
  const { rows: [{ n }] } = await submit(db, setId, [
    { subject_id: subjectId, tools: "클립스튜디오", supplies: "타블렛", steps: [{ step_label: "1단계", written: "웹툰1 원문" }] },
    { new_name: "웹툰2", from: subjectId, steps: [{ step_label: "1단계", written: "웹툰2 원문" }, { step_label: "2단계", written: "웹툰2 둘째" }] },
  ]);
  assert.equal(n, 3);
  await as(db, "authenticated", TEACHER);
  await submit(db, setId, [{ subject_id: subjectId, steps: [{ step_label: "1단계", written: "고친 원문" }] }]);
  assert.deepEqual(await rowsOf(db, me), [
    { name: "웹툰1", step_label: "1단계", written: "고친 원문" },
    { name: "웹툰2", step_label: "1단계", written: "웹툰2 원문" },
    { name: "웹툰2", step_label: "2단계", written: "웹툰2 둘째" },
  ]);
  const { rows: [m] } = await db.query(`select tools, supplies from instructor_subject_materials where instructor_id = $1`, [me]);
  assert.deepEqual(m, { tools: "클립스튜디오", supplies: "타블렛" });
});

test("하나라도 실패하면(빈 내용·http 이미지) 새 과목·준비물·앞 단계까지 아무것도 남지 않는다", async () => {
  const { db, setId, subjectId, me } = await setup();
  await as(db, "authenticated", TEACHER);
  await assert.rejects(submit(db, setId, [
    { subject_id: subjectId, tools: "x", steps: [{ step_label: "1단계", written: "좋은 내용" }] },
    { new_name: "웹툰2", from: subjectId, steps: [{ step_label: "1단계", written: "  " }] },
  ]), /단계와 커리큘럼 내용/);
  await assert.rejects(submit(db, setId, [{ subject_id: subjectId, steps: [{ step_label: "1단계", written: "내용", media_url: "http://x" }] }]), /https/);
  assert.deepEqual(await rowsOf(db, me), []);
  const { rows } = await db.query(`select 1 from subjects where name = '웹툰2'`);
  assert.equal(rows.length, 0, "새 달 과목도 안 생김");
});

test("대신 등록은 학과장·관리자만, 같은 검사를 거친다", async () => {
  const { db, setId, subjectId, other } = await setup();
  await as(db, "authenticated", TEACHER);
  await assert.rejects(submit(db, setId, [{ subject_id: subjectId, steps: [{ step_label: "1단계", written: "x" }] }], other), /학과장·관리자/);
  await as(db, "authenticated", HEAD);
  await assert.rejects(submit(db, setId, [{ subject_id: subjectId, steps: [{ step_label: "", written: "x" }] }], other), /단계와/);
  await submit(db, setId, [{ subject_id: subjectId, steps: [{ step_label: "1단계", written: "대신 쓴 원문" }] }], other);
  assert.deepEqual(await rowsOf(db, other), [{ name: "웹툰1", step_label: "1단계", written: "대신 쓴 원문" }]);
});

test("개월 추가는 과목과 빈 1단계 신청을 함께 만들고, 개월 빼기는 한 묶음의 대기 신청만 지운다", async () => {
  const { db, setId, subjectId, me, other } = await setup();
  await as(db, "authenticated", HEAD);
  const { rows: [{ sid }] } = await db.query(`select comsw_add_month_request($1, '웹툰2', $2, $3) sid`, [subjectId, setId, me]);
  await db.query(`select comsw_add_month_request($1, '웹툰2', $2, $3)`, [subjectId, setId, me]);
  await as(db, null);
  const { rows: ids } = await db.query(`select id from instructor_curricula where subject_id = $1 and status = 'pending'`, [sid]);
  assert.equal(ids.length, 1, "다시 눌러도 빈 신청은 하나");
  await as(db, "authenticated", HEAD);
  await submit(db, setId, [{ subject_id: subjectId, steps: [{ step_label: "1단계", written: "다른 묶음" }] }], other);
  await as(db, null);
  const { rows: [otherRow] } = await db.query(`select id from instructor_curricula where instructor_id = $1`, [other]);
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_drop_requests($1::uuid[])`, [[ids[0].id, otherRow.id]]), /같은 묶음/);
  const { rows: [{ n }] } = await db.query(`select comsw_drop_requests($1::uuid[]) n`, [[ids[0].id]]);
  assert.equal(n, 1);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_drop_requests($1::uuid[])`, [[otherRow.id]]), /권한/);
});
