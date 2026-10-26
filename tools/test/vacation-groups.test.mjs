// 방학 특강 그룹(curriculum_sets.is_vacation)과 선생님 '방특' 제출(instructor_curricula.vacation).
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };
const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };

async function setup() {
  const db = await seeded();
  await as(db, null);
  await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1')`);
  const { rows: [s] } = await db.query(`select id from subjects order by name limit 1`);
  const { rows: [set] } = await db.query(`select id from curriculum_sets where not is_vacation limit 1`);
  const { rows: [group] } = await db.query(`insert into curriculum_sets(name, is_vacation) values ('2027 겨울방학특강', true) returning id`);
  return { db, subjectId: s.id, setId: set.id, groupId: group.id };
}

test("'방특'으로 낸 커리큘럼은 vacation 표시로 따로 쌓이고, 예전 6개 인자 호출은 일반 제출", async () => {
  const { db, subjectId, setId } = await setup();
  await as(db, "authenticated", TEACHER);
  const submit = async (vacation) => (await db.query(
    vacation === undefined
      ? `select comsw_submit_my_curriculum($1, $2, '1단계', '원문', '', '') id`
      : `select comsw_submit_my_curriculum($1, $2, '1단계', '원문', '', '', $3) id`,
    vacation === undefined ? [setId, subjectId] : [setId, subjectId, vacation])).rows[0].id;
  const normal = await submit();
  const vac = await submit(true);
  assert.notEqual(normal, vac, "같은 단계라도 방특과 일반은 따로");
  assert.equal(await submit(true), vac, "방특을 다시 내면 그 대기 줄을 고침");
  await as(db, null);
  const { rows } = await db.query(`select id, vacation from instructor_curricula where id in ($1, $2) order by vacation`, [normal, vac]);
  assert.deepEqual(rows.map((r) => r.vacation), [false, true]);
});

test("관리자가 방특 줄을 그룹 세트로 옮겨 승인하면 그 그룹의 강의가 된다", async () => {
  const { db, subjectId, setId, groupId } = await setup();
  await as(db, "authenticated", TEACHER);
  const { rows: [{ id }] } = await db.query(`select comsw_submit_my_curriculum($1, $2, '1단계', '원문', '', '', true) id`, [setId, subjectId]);
  await as(db, "authenticated", ADMIN);
  await db.query(`update instructor_curricula set set_id = $2 where id = $1`, [id, groupId]);
  await db.query(`select comsw_approve_curriculum($1)`, [id]);
  await as(db, null);
  const { rows: [row] } = await db.query(`select set_id, status, vacation from instructor_curricula where id = $1`, [id]);
  assert.deepEqual(row, { set_id: groupId, status: "approved", vacation: true });
});
