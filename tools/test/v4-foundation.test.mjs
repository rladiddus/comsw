// V4 바탕(20261119010000): 확정한 건만 공개(다른 미반영 변경이 있으면 멈춤), 과목 삭제·복원, 강사 노출, 옛 '웹툰' 옮기기.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, runMigration, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "uid-t", role: "authenticated", comsw_role: "teacher" };
const V4 = "20261119010000_v4_foundation.sql";
const migrate = async (db) => { await as(db, null); await runMigration(db, V4); await as(db, "authenticated", HEAD); };

async function seed(db) {
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d1 = await one(`insert into departments(name, sort_order) values ('건축학과', 0) returning id`);
  const d2 = await one(`insert into departments(name, sort_order) values ('인테리어학과', 1) returning id`);
  const cad = await one(`insert into subjects(name, sort_order) values ('캐드1', 0) returning id`);
  const rhino = await one(`insert into subjects(name, sort_order) values ('라이노1', 1) returning id`);
  const webtoon = await one(`insert into subjects(name, sort_order) values ('웹툰', 2) returning id`);
  await db.query(`insert into subject_departments(subject_id, department_id) values ($1,$3),($1,$4),($2,$4),($5,$3)`, [cad, rhino, d1, d2, webtoon]);
  const set = await one(`insert into curriculum_sets(name, department_id) values ('건축학과', $1) returning id`, [d1]);
  const vac = await one(`insert into curriculum_sets(name, is_vacation) values ('2026 겨울', true) returning id`);
  await db.query(`insert into vacation_set_subjects values ($1, $2)`, [vac, cad]);
  const i1 = await one(`insert into instructors(name, is_listed) values ('김강사', true) returning id`);
  await db.query(`insert into instructor_subjects(instructor_id, subject_id) values ($1,$2),($1,$3)`, [i1, cad, rhino]);
  await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status) values ($1,$2,$3,'1단계','캐드 원문','approved')`, [set, i1, cad]);
  await db.query(`insert into course_prep_items(subject_id, category, content) values ($1, 'supply', '삼각자')`, [cad]);
  const track = await one(`insert into roadmap_tracks(name, department_id) values ('건축', $1) returning id`, [d1]);
  const step = await one(`insert into roadmap_steps(track_id, position) values ($1, 1) returning id`, [track]);
  await db.query(`insert into roadmap_step_subjects(step_id, subject_id) values ($1, $2)`, [step, cad]);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  return { d1, d2, cad, rhino, webtoon, vac, i1 };
}

const latest = async (db) => {
  await as(db, null);
  const { rows: [r] } = await db.query(`select id, rows from site_snapshots order by id desc limit 1`);
  await as(db, "authenticated", HEAD);
  return r;
};
const sheet = (snap, name) => snap.rows.filter((r) => r.sheet_name === name).map((r) => r.data.values);
const names = (snap) => sheet(snap, "컴수원_전체수업").map((v) => v[2]).filter(Boolean);

test("마이그레이션: 학과별 순서는 지금 순서로, 옛 '웹툰'은 삭제된 과목으로 옮기고(깨끗할 때) 바로 공개", async () => {
  const db = await freshDb(V4);
  const ids = await seed(db);
  assert.ok(names(await latest(db)).includes("웹툰"));
  await migrate(db);
  await as(db, null);
  const { rows: [w] } = await db.query(`select deleted_at, sort_order from subjects where id = $1`, [ids.webtoon]);
  assert.ok(w.deleted_at, "웹툰 삭제 표시");
  assert.equal(w.sort_order, null);
  assert.equal((await db.query(`select count(*)::int n from subject_departments where subject_id = $1`, [ids.webtoon])).rows[0].n, 0);
  assert.deepEqual((await db.query(`select sort_order from subject_departments where subject_id = $1 order by department_id`, [ids.cad])).rows.map((r) => r.sort_order), [0, 0]);
  const snap = await latest(db);
  assert.equal(snap.rows.length > 0 && !names(snap).includes("웹툰"), true, "새 스냅샷에서 빠짐");
  await as(db, "authenticated", HEAD);
  assert.equal((await db.query(`select comsw_v4_unpublished() u`)).rows[0].u, false);
});

test("다른 곳에서 고치고 반영하지 않은 변경이 있으면 V4 확정을 멈춘다(섞여 공개되지 않음)", async () => {
  const db = await freshDb(V4);
  const ids = await seed(db);
  await migrate(db);
  const before = await latest(db);
  await db.query(`update subjects set duration = '3개월' where id = $1`, [ids.rhino]); // V3에서 저장만 한 것
  assert.equal((await db.query(`select comsw_v4_unpublished() u`)).rows[0].u, true);
  await assert.rejects(db.query(`select comsw_v4_set_instructor_listed($1, false)`, [ids.i1]), /반영하지 않은 다른 변경/);
  assert.equal((await latest(db)).id, before.id, "스냅샷 그대로");
  await as(db, null);
  assert.equal((await db.query(`select is_listed from instructors where id = $1`, [ids.i1])).rows[0].is_listed, true, "확정도 안 됨");
});

test("특강 신청 수만 바뀐 것은 막지 않는다", async () => {
  const db = await freshDb(V4);
  const ids = await seed(db);
  await as(db, null);
  const { rows: [s] } = await db.query(`insert into seminars(title) values ('특강') returning id`);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  await migrate(db);
  await as(db, null);
  await db.query(`insert into seminar_applications(seminar_id, name, phone) values ($1, '홍길동', '010-0000-0000')`, [s.id]);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_v4_set_instructor_listed($1, false)`, [ids.i1]);
  assert.equal(sheet(await latest(db), "강사페이지").length, 0, "노출 끈 강사는 바로 빠짐");
});

test("과목 삭제: 모든 학과·방학 특강·로드맵 연결 해제, 공개에서 빠짐, 자료는 보관. 복원은 다시 연결해야 공개", async () => {
  const db = await freshDb(V4);
  const ids = await seed(db);
  await migrate(db);
  const { rows: [{ r }] } = await db.query(`select comsw_v4_delete_subject($1) r`, [ids.cad]);
  assert.deepEqual(r, { departments: ["건축학과", "인테리어학과"], vacations: ["2026 겨울"] });
  let snap = await latest(db);
  assert.ok(!names(snap).includes("캐드1"));
  assert.equal(sheet(snap, "수업별 준비물(AI/교재 등)").length, 0, "준비물 공개 안 됨");
  assert.equal(snap.rows.filter((x) => x.source_id === "instructor_curriculum").length, 0, "강사 커리큘럼 공개 안 됨");
  assert.equal(sheet(snap, "강사페이지")[0][2], "라이노1", "강사 담당 과목에서도 빠짐");
  await as(db, null);
  const kept = (await db.query(`select (select count(*) from instructor_curricula where subject_id = $1)::int c, (select count(*) from course_prep_items where subject_id = $1)::int p`, [ids.cad])).rows[0];
  assert.deepEqual(kept, { c: 1, p: 1 }, "자료 보관");
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`insert into subject_departments(subject_id, department_id) values ($1, $2)`, [ids.cad, ids.d1]), /복원한 뒤/);

  await db.query(`select comsw_v4_restore_subject($1)`, [ids.cad]);
  assert.equal((await db.query(`select comsw_v4_unpublished() u`)).rows[0].u, false, "복원만으로는 공개가 안 바뀜");
  await as(db, null);
  assert.equal((await db.query(`select count(*)::int n from subject_departments where subject_id = $1`, [ids.cad])).rows[0].n, 0, "옛 연결 자동 복구 없음");
  await as(db, "authenticated", HEAD);
  await db.query(`insert into subject_departments(subject_id, department_id) values ($1, $2)`, [ids.cad, ids.d1]);
  await as(db, null);
  assert.equal((await db.query(`select relink_needed from subjects where id = $1`, [ids.cad])).rows[0].relink_needed, false, "다시 연결하면 풀림");
});

test("선생님은 V4 확정·삭제·복원·보관함을 쓸 수 없다", async () => {
  const db = await freshDb(V4);
  const ids = await seed(db);
  await migrate(db);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_v4_delete_subject($1)`, [ids.rhino]), /권한/);
  await assert.rejects(db.query(`select comsw_v4_restore_subject($1)`, [ids.rhino]), /권한/);
  await assert.rejects(db.query(`select comsw_v4_set_instructor_listed($1, false)`, [ids.i1]), /권한/);
  await assert.rejects(db.query(`select comsw_v4_unpublished()`), /권한/);
  await assert.rejects(db.query(`insert into v4_drafts(kind, target) values ('common', 'x')`));
  assert.equal((await db.query(`select count(*)::int n from v4_drafts`)).rows[0].n, 0);
  await as(db, "anon");
  await assert.rejects(db.query(`select comsw_v4_delete_subject($1)`, [ids.rhino]));
});
