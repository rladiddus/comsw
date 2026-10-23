// 과목 프로그램·준비물: 관리 화면은 나눠 고치고(tools/supplies), 사이트 칸(program)은 둘을 합친 값.
// 선생님이 적은 프로그램·준비물은 커리큘럼을 승인할 때 과목 값에 합친다.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };
const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };

async function setup() {
  const db = await seeded();
  await as(db, null);
  const { rows: [i] } = await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1') returning id`);
  const { rows: [s] } = await db.query(`select id from subjects order by name limit 1`);
  const { rows: [set] } = await db.query(`select id from curriculum_sets limit 1`);
  await db.query(`update subjects set tools = 'Photoshop', supplies = '멘토시리즈 포토샵' where id = $1`, [s.id]);
  return { db, instructorId: i.id, subjectId: s.id, setId: set.id };
}
const subject = async (db, id) => {
  await as(db, null);
  return (await db.query(`select tools, supplies, program from subjects where id = $1`, [id])).rows[0];
};

test("사이트 칸(program)은 프로그램 줄 + 준비물 줄", async () => {
  const { db, subjectId } = await setup();
  assert.deepEqual(await subject(db, subjectId), { tools: "Photoshop", supplies: "멘토시리즈 포토샵", program: "Photoshop\n멘토시리즈 포토샵" });
  await db.query(`update subjects set tools = null where id = $1`, [subjectId]);
  assert.equal((await subject(db, subjectId)).program, "멘토시리즈 포토샵");
  await db.query(`update subjects set supplies = '' where id = $1`, [subjectId]);
  assert.equal((await subject(db, subjectId)).program, null);
});

test("선생님은 자기 프로그램·준비물만 함수로 저장하고, 승인하면 새 항목만 과목 값 뒤에 붙는다", async () => {
  const { db, subjectId, setId, instructorId } = await setup();
  await as(db, "authenticated", TEACHER);
  await db.query(`select comsw_save_my_materials($1, $2, $3)`, [subjectId, "photoshop, Illustrator", "이어폰\n멘토시리즈 포토샵"]);
  await assert.rejects(db.query(`insert into instructor_subject_materials(instructor_id, subject_id, tools) values ($1, $2, 'x')`, [instructorId, subjectId]));
  const { rows: mine } = await db.query(`select tools, supplies from instructor_subject_materials`);
  assert.deepEqual(mine, [{ tools: "photoshop, Illustrator", supplies: "이어폰\n멘토시리즈 포토샵" }]);
  const { rows: [{ id }] } = await db.query(
    `select comsw_submit_my_curriculum($1, $2, '1단계', '원문', '', '') id`, [setId, subjectId]);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_approve_curriculum($1)`, [id]);
  assert.deepEqual(await subject(db, subjectId), {
    tools: "Photoshop\nIllustrator", supplies: "멘토시리즈 포토샵\n이어폰", program: "Photoshop\nIllustrator\n멘토시리즈 포토샵\n이어폰",
  });
  // 같은 내용으로 또 승인해도 두 번 붙지 않는다.
  await as(db, "authenticated", TEACHER);
  const { rows: [{ id: again }] } = await db.query(
    `select comsw_submit_my_curriculum($1, $2, '2단계', '원문', '', '') id`, [setId, subjectId]);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_approve_curriculum($1)`, [again]);
  assert.equal((await subject(db, subjectId)).tools, "Photoshop\nIllustrator");
});

test("다른 강사의 프로그램·준비물은 선생님에게 안 보인다", async () => {
  const { db, subjectId } = await setup();
  await as(db, null);
  const { rows: [other] } = await db.query(`insert into instructors(name, account_uid) values ('t2', 'uid-t2') returning id`);
  await db.query(`insert into instructor_subject_materials(instructor_id, subject_id, tools) values ($1, $2, 'Max')`, [other.id, subjectId]);
  await as(db, "authenticated", TEACHER);
  assert.equal((await db.query(`select * from instructor_subject_materials`)).rows.length, 0);
});
