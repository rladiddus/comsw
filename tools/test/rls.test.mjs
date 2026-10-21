import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "h", role: "authenticated", comsw_role: "head" };
const T1 = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };

async function seeded() {
  const db = await freshDb();
  await db.exec(`
    insert into departments(name) values ('웹학과');
    insert into subjects(name) values ('웹1');
    insert into curriculum_sets(name) values ('웹학과');
    insert into instructors(name, account_uid) values ('t1', 'uid-t1'), ('t2', 'uid-t2');
    insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, status)
      select s.id, i.id, j.id, '1주차', 'approved' from curriculum_sets s, instructors i, subjects j;
    insert into seminars(title) values ('특강');
    insert into seminar_applications(seminar_id, name, phone) select id, '홍길동', '010-0000-0000' from seminars;
  `);
  return db;
}

test("익명은 콘텐츠와 신청자를 읽지 못한다", async () => {
  const db = await seeded();
  await as(db, "anon");
  assert.equal((await db.query(`select * from subjects`)).rows.length, 0);
  assert.equal((await db.query(`select * from seminar_applications`)).rows.length, 0);
});

test("역할 없는 로그인 사용자도 읽지 못한다", async () => {
  const db = await seeded();
  await as(db, "authenticated", { sub: "x" });
  assert.equal((await db.query(`select * from departments`)).rows.length, 0);
});

test("학과장은 신청자 명단을 읽고 과목을 고칠 수 있다", async () => {
  const db = await seeded();
  await as(db, "authenticated", HEAD);
  assert.equal((await db.query(`select * from seminar_applications`)).rows.length, 1);
  const r = await db.query(`update subjects set duration = '2개월' returning id`);
  assert.equal(r.rows.length, 1);
});

test("선생님은 본인 커리큘럼만 보고, 고치면 pending이어야 한다", async () => {
  const db = await seeded();
  await as(db, "authenticated", T1);
  assert.equal((await db.query(`select * from instructor_curricula`)).rows.length, 1);
  await assert.rejects(db.query(`update instructor_curricula set summary='x', status='approved'`));
  const r = await db.query(`update instructor_curricula set summary='x', status='pending' returning id`);
  assert.equal(r.rows.length, 1);
  assert.equal((await db.query(`select * from seminar_applications`)).rows.length, 0);
});

test("선생님은 다른 선생님 커리큘럼을 만들 수 없다", async () => {
  const db = await seeded();
  await as(db, "authenticated", T1);
  await assert.rejects(db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, status)
    select s.id, i.id, j.id, '9주차', 'pending' from curriculum_sets s, instructors i, subjects j where i.account_uid='uid-t2'`));
});

test("선생님은 과목을 고칠 수 없다", async () => {
  const db = await seeded();
  await as(db, "authenticated", T1);
  const r = await db.query(`update subjects set duration='x' returning id`);
  assert.equal(r.rows.length, 0);
});
