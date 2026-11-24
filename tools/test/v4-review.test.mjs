// V4 검수(20261119020000): 4단계일 때만 확정, 그 건만 공개, 예전 검수본 보관, 강사 준비물이 공통 준비물로 새지 않음, 저장함 권한.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };
const T1 = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };
const T2 = { sub: "uid-t2", role: "authenticated", comsw_role: "teacher" };

async function setup() {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d = await one(`insert into departments(name) values ('건축학과') returning id`);
  const s = await one(`insert into subjects(name, sort_order) values ('캐드1', 0) returning id`);
  await db.query(`insert into subject_departments(subject_id, department_id) values ($1, $2)`, [s, d]);
  const set = await one(`insert into curriculum_sets(name, department_id) values ('건축학과', $1) returning id`, [d]);
  const i1 = await one(`insert into instructors(name, account_uid, is_listed) values ('김강사', 'uid-t1', false) returning id`);
  const i2 = await one(`insert into instructors(name, account_uid) values ('이강사', 'uid-t2') returning id`);
  await db.query(`insert into instructor_departments values ($1, $2)`, [i1, d]);
  for (let n = 1; n <= 6; n++) {
    await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status, sort_order) values ($1,$2,$3,$4,$5,'approved',$6)`, [set, i1, s, `${n}단계`, `옛 ${n}`, n]);
  }
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  return { db, d, s, set, i1, i2 };
}

const submit = (db, set, s, steps, extra = {}) => db.query(`select comsw_submit_curriculum($1, false, $2::jsonb, null) n`,
  [set, JSON.stringify([{ subject_id: s, ...extra, steps: steps.map((n) => ({ step_label: `${n}단계`, written: `새 ${n}`, media_url: "" })) }])]);
const pending = async (db, i1) => (await db.query(`select id, updated_at, step_label from instructor_curricula where instructor_id = $1 and status = 'pending' order by step_label`, [i1])).rows;
const steps = (rows) => rows.map((r) => ({ id: r.id, updated_at: r.updated_at.toISOString(), summary: `요약 ${r.step_label}` }));
const latest = async (db) => {
  await as(db, null);
  const r = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  await as(db, "authenticated", HEAD);
  return r;
};

test("4단계가 아니면 확정 안 됨 → 4단계면 확정: 그 건만 공개, 예전 6단계는 보관, 준비물·노출은 그대로", async () => {
  const { db, s, set, i1 } = await setup();
  await as(db, "authenticated", T1);
  await submit(db, set, s, [1, 2, 3], { supplies: "삼각자" });
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_v4_confirm_curriculum($1,$2,$3,$4::jsonb)`, [i1, set, s, JSON.stringify(steps(await pending(db, i1)))]), /4단계가 되어야 확정/);
  await as(db, "authenticated", T1);
  await submit(db, set, s, [1, 2, 3, 4], { supplies: "삼각자" });
  await as(db, "authenticated", HEAD);
  const rows = await pending(db, i1);
  assert.equal(rows.length, 4);
  await db.query(`select comsw_v4_confirm_curriculum($1,$2,$3,$4::jsonb)`, [i1, set, s, JSON.stringify(steps(rows))]);
  await as(db, null);
  const live = (await db.query(`select step_label, written, summary from instructor_curricula where instructor_id = $1 order by step_label`, [i1])).rows;
  assert.deepEqual(live.map((r) => [r.step_label, r.written, r.summary]), [1, 2, 3, 4].map((n) => [`${n}단계`, `새 ${n}`, `요약 ${n}단계`]));
  const arch = (await db.query(`select rows from v4_curricula_archive`)).rows;
  assert.equal(arch[0].rows.length, 6, "예전 6단계 보관");
  assert.equal((await db.query(`select count(*)::int n from course_prep_items`)).rows[0].n, 0, "강사 준비물이 공통 준비물로 새지 않음");
  assert.equal((await db.query(`select is_listed from instructors where id = $1`, [i1])).rows[0].is_listed, false);
  const pub = (await latest(db)).filter((r) => r.source_id === "instructor_curriculum").map((r) => r.data.values);
  assert.deepEqual(pub.map((v) => [v[2], v[4]]), [1, 2, 3, 4].map((n) => [`${n}단계`, `요약 ${n}단계`]), "확정한 4단계가 바로 공개");
});

test("그사이 제출이 바뀌면 확정을 멈춘다, 선생님은 확정 못 함", async () => {
  const { db, s, set, i1 } = await setup();
  await as(db, "authenticated", T1);
  await submit(db, set, s, [1, 2, 3, 4]);
  await as(db, "authenticated", HEAD);
  const seen = steps(await pending(db, i1));
  await as(db, "authenticated", T1);
  await assert.rejects(db.query(`select comsw_v4_confirm_curriculum($1,$2,$3,$4::jsonb)`, [i1, set, s, JSON.stringify(seen)]), /권한/);
  await db.query(`select comsw_submit_curriculum($1, false, $2::jsonb, null)`, [set, JSON.stringify([{ subject_id: s, steps: [{ step_label: "2단계", written: "다시 고침", media_url: "" }] }])]);
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_v4_confirm_curriculum($1,$2,$3,$4::jsonb)`, [i1, set, s, JSON.stringify(seen)]), /바뀌었습니다/);
});

test("프로필 확정은 노출 여부를 바꾸지 않고, 학과장이 고친 문구로 공개", async () => {
  const { db, i1 } = await setup();
  await as(db, "authenticated", T1);
  await db.query(`select comsw_save_my_profile('김강사', '경력 원문', '한마디 원문', null, false)`);
  await as(db, "authenticated", HEAD);
  const { rows: [d] } = await db.query(`select updated_at from instructor_profile_drafts where instructor_id = $1`, [i1]);
  await db.query(`select comsw_v4_confirm_profile($1, $2, $3, null)`, [i1, d.updated_at.toISOString(), "다듬은 경력"]);
  await as(db, null);
  const { rows: [p] } = await db.query(`select career, message, is_listed from instructors where id = $1`, [i1]);
  assert.deepEqual(p, { career: "다듬은 경력", message: "한마디 원문", is_listed: false });
});

test("작성 저장함: 본인 것만 쓰고 읽음, 학과장은 읽기만", async () => {
  const { db, i1, i2 } = await setup();
  await as(db, "authenticated", T1);
  await db.query(`insert into v4_teacher_drafts(instructor_id, kind, target, payload) values ($1, 'curriculum', 'x', '{"a":1}')`, [i1]);
  await assert.rejects(db.query(`insert into v4_teacher_drafts(instructor_id, kind, target) values ($1, 'curriculum', 'x')`, [i2]));
  await as(db, "authenticated", T2);
  assert.equal((await db.query(`select count(*)::int n from v4_teacher_drafts`)).rows[0].n, 0, "남의 것은 안 보임");
  await as(db, "authenticated", HEAD);
  assert.equal((await db.query(`select count(*)::int n from v4_teacher_drafts`)).rows[0].n, 1);
  await db.query(`delete from v4_teacher_drafts`);
  await as(db, null);
  assert.equal((await db.query(`select count(*)::int n from v4_teacher_drafts`)).rows[0].n, 1, "학과장은 지우지 못함");
});

test("프로필 확정 사진: 고른 주소만 공개, 고르지 않으면 AI 사진이 있어도 지금 사진 그대로, 이상한 주소는 막음", async () => {
  const { db, i1 } = await setup();
  const draft = async () => {
    await as(db, "authenticated", T1);
    await db.query(`select comsw_save_my_profile('김강사', '경력', '한마디', null, false)`);
    await as(db, null);
    await db.query(`update instructor_profile_drafts set photo_url = 'https://x.test/ai.png' where instructor_id = $1`, [i1]);
    return (await db.query(`select updated_at from instructor_profile_drafts where instructor_id = $1`, [i1])).rows[0].updated_at.toISOString();
  };
  const confirm = async (at, url) => { await as(db, "authenticated", HEAD); await db.query(`select comsw_v4_confirm_profile($1, $2, null, null, $3)`, [i1, at, url]); };
  const photos = async () => {
    await as(db, null);
    return (await db.query(`select i.photo_url a, d.photo_url b from instructors i join instructor_profile_drafts d on d.instructor_id = i.id where i.id = $1`, [i1])).rows[0];
  };
  await as(db, null);
  await db.query(`update instructors set photo_url = 'https://x.test/home.webp' where id = $1`, [i1]);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  let at = await draft();
  await assert.rejects(confirm(at, "javascript:alert(1)"), /사진 주소/);
  await confirm(at, null);
  assert.deepEqual(await photos(), { a: "https://x.test/home.webp", b: null });
  at = await draft();
  await confirm(at, "https://x.test/public.webp");
  assert.deepEqual(await photos(), { a: "https://x.test/public.webp", b: "https://x.test/public.webp" });
  at = await draft();
  await as(db, "authenticated", T1);
  await assert.rejects(db.query(`select comsw_v4_confirm_profile($1, $2, null, null, null)`, [i1, at]), /권한/);
});
