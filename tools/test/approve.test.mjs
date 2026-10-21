import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };
const TEACHER = { sub: "t", role: "authenticated", comsw_role: "teacher" };

// 웹학과 세트의 김민주 '웹1' 1주차(승인됨)를 대신할 대기 줄 하나를 만든다.
async function withPending() {
  const db = await seeded();
  const { rows: [old] } = await db.query(`
    select c.* from instructor_curricula c join curriculum_sets s on s.id = c.set_id
    join instructors i on i.id = c.instructor_id
    where s.name = '웹학과' and i.name = '김민주' and c.step_label = '1주차'`);
  const { rows: [pending] } = await db.query(`
    insert into instructor_curricula (set_id, instructor_id, subject_id, step_label, written, status)
    values ($1, $2, $3, '1주차', '새 원문', 'pending') returning id`, [old.set_id, old.instructor_id, old.subject_id]);
  return { db, oldId: old.id, pendingId: pending.id };
}

test("승인하면 같은 세트·강사·과목·주차의 예전 승인 줄을 대신한다", async () => {
  const { db, oldId, pendingId } = await withPending();
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_approve_curriculum($1)`, [pendingId]);
  await as(db, null);
  const { rows } = await db.query(`select id, status, written from instructor_curricula where id in ($1, $2)`, [oldId, pendingId]);
  assert.deepEqual(rows, [{ id: pendingId, status: "approved", written: "새 원문" }]);
});

test("다른 주차·다른 강사의 승인 줄은 그대로", async () => {
  const { db, pendingId } = await withPending();
  await as(db, null);
  const before = (await db.query(`select count(*)::int n from instructor_curricula where status = 'approved'`)).rows[0].n;
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_approve_curriculum($1)`, [pendingId]);
  await as(db, null);
  assert.equal((await db.query(`select count(*)::int n from instructor_curricula where status = 'approved'`)).rows[0].n, before);
});

test("선생님·등급 없는 사용자는 승인할 수 없다", async () => {
  const { db, pendingId } = await withPending();
  for (const claims of [TEACHER, { sub: "x", role: "authenticated" }]) {
    await as(db, "authenticated", claims);
    await assert.rejects(db.query(`select comsw_approve_curriculum($1)`, [pendingId]), /승인 권한이 없습니다/);
  }
  await as(db, "anon");
  await assert.rejects(db.query(`select comsw_approve_curriculum($1)`, [pendingId]));
});
