// V4 4단계(20261119030000): 공통 4단계(고른 검수본·그 이미지만), 기준 과목 준비물, 학과 구성·순서(다른 학과 그대로), 공개 순서 칸.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, runMigration, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };
const LAST = "20261119030000_v4_common.sql";

async function setup({ before = false } = {}) {
  const db = await freshDb(before ? LAST : undefined);
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d1 = await one(`insert into departments(name, sort_order) values ('건축학과', 0) returning id`);
  const d2 = await one(`insert into departments(name, sort_order) values ('인테리어학과', 1) returning id`);
  const cad1 = await one(`insert into subjects(name, sort_order) values ('캐드1', 0) returning id`);
  const cad2 = await one(`insert into subjects(name, sort_order) values ('캐드2', 1) returning id`);
  const rhino = await one(`insert into subjects(name, sort_order) values ('라이노', 2) returning id`);
  const etc = await one(`insert into subjects(name) values ('스케치업') returning id`);
  await db.query(`insert into subject_departments(subject_id, department_id, sort_order) values ($1,$4,0),($2,$4,1),($3,$4,2),($3,$5,0),($1,$5,1)`, [cad1, cad2, rhino, d1, d2]);
  const set = await one(`insert into curriculum_sets(name, department_id) values ('건축학과', $1) returning id`, [d1]);
  const vac = await one(`insert into curriculum_sets(name, is_vacation) values ('2026 겨울', true) returning id`);
  const i1 = await one(`insert into instructors(name) values ('김강사') returning id`);
  const rows = [];
  for (let n = 1; n <= 4; n++) {
    rows.push((await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, media_url, status) values ($1,$2,$3,$4,$5,$6,'approved') returning id, updated_at`,
      [set, i1, cad1, `${n}단계`, `원문 ${n}`, `https://img/${n}.webp`])).rows[0]);
  }
  const pend = (await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, media_url, status) values ($1,$2,$3,'1단계','대기','https://img/p.webp','pending') returning id, updated_at`, [set, i1, cad1])).rows[0];
  const vacRow = (await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status) values ($1,$2,$3,'1단계','방특','approved') returning id, updated_at`, [vac, i1, cad1])).rows[0];
  for (let n = 1; n <= 6; n++) await db.query(`insert into subject_weeks(subject_id, week_label, summary, sort_order) values ($1, $2, '옛', $3)`, [cad1, `${n}단계`, n]);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  return { db, d1, d2, cad1, cad2, rhino, etc, rows, pend, vacRow };
}
const src = (rows) => JSON.stringify(rows.map((r) => ({ id: r.id, updated_at: r.updated_at.toISOString() })));
const stepsWith = (img) => JSON.stringify([1, 2, 3, 4].map((n) => ({ summary: `공통 ${n}`, image_url: n === 1 ? img : "" })));
const latest = async (db) => { await as(db, null); const r = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows; await as(db, "authenticated", HEAD); return r; };

test("공통 4단계: 검수 완료본만, 이미지는 그 자료의 것만, 예전 6단계 보관, 바로 공개", async () => {
  const { db, cad1, rows, pend, vacRow } = await setup();
  const confirm = (sources, steps) => db.query(`select comsw_v4_confirm_common($1, $2::jsonb, $3::jsonb)`, [cad1, sources, steps]);
  await assert.rejects(confirm(src([pend]), stepsWith("")), /검수 완료본이 아니거나/, "대기 줄은 못 씀");
  await assert.rejects(confirm(src([vacRow]), stepsWith("")), /검수 완료본이 아니거나/, "방학 특강 자료는 일반 공통에 못 씀");
  await assert.rejects(confirm(src(rows), stepsWith("https://img/p.webp")), /이미지 중에서/, "고른 자료 밖 이미지 막음");
  await assert.rejects(confirm(src(rows), JSON.stringify([{ summary: "하나" }])), /4단계 문구/);
  await confirm(src(rows), stepsWith("https://img/1.webp"));
  await as(db, null);
  const w = (await db.query(`select week_label, summary, image_url from subject_weeks where subject_id = $1 order by sort_order`, [cad1])).rows;
  assert.deepEqual(w.map((r) => [r.week_label, r.summary]), [1, 2, 3, 4].map((n) => [`${n}단계`, `공통 ${n}`]));
  assert.equal(w[0].image_url, "https://img/1.webp");
  assert.equal((await db.query(`select rows from v4_common_archive`)).rows[0].rows.length, 6);
  assert.equal((await db.query(`select jsonb_array_length(sources) n from v4_common_meta`)).rows[0].n, 4, "참고한 버전 기록");
  const pub = (await latest(db)).filter((r) => r.sheet_name === "컴수원_전체수업" && r.data.values[2] === "캐드1");
  assert.deepEqual(pub.map((r) => r.data.values[5]), [1, 2, 3, 4].map((n) => `공통 ${n}`));
});

test("공통 준비물: 기준 과목(캐드)의 캐드1·캐드2에 같은 목록, 링크는 http(s)만", async () => {
  const { db, cad1, cad2 } = await setup();
  await assert.rejects(db.query(`select comsw_v4_confirm_prep('캐드', $1::jsonb)`, [JSON.stringify([{ category: "ai", content: "x", link_url: "javascript:alert(1)" }])]), /링크/);
  const n = (await db.query(`select comsw_v4_confirm_prep('캐드', $1::jsonb) n`, [JSON.stringify([{ category: "supply", content: "삼각자" }, { category: "ai", content: "ChatGPT", link_url: "https://chatgpt.com" }])])).rows[0].n;
  assert.equal(n, 2);
  await as(db, null);
  const items = (await db.query(`select subject_id, content from course_prep_items order by subject_id, sort_order`)).rows;
  assert.equal(items.filter((i) => i.subject_id === cad1).length, 2);
  assert.equal(items.filter((i) => i.subject_id === cad2).length, 2);
});

test("학과 구성: 이 학과만 바뀌고 다른 학과 순서는 그대로, 공개 순서 칸, 빠진 과목은 이 학과에서만", async () => {
  const { db, d1, d2, cad1, cad2, rhino, etc } = await setup();
  await db.query(`select comsw_v4_save_department_layout($1, $2::uuid[])`, [d1, [rhino, etc, cad1]]);
  await as(db, null);
  const order = async (d) => (await db.query(`select subject_id from subject_departments where department_id = $1 order by sort_order`, [d])).rows.map((r) => r.subject_id);
  assert.deepEqual(await order(d1), [rhino, etc, cad1]);
  assert.deepEqual(await order(d2), [rhino, cad1], "다른 학과 그대로");
  assert.equal((await db.query(`select count(*)::int n from subject_departments where subject_id = $1`, [cad2])).rows[0].n, 0, "캐드2는 건축에서만 빠짐(다른 학과 없음)");
  assert.notEqual((await db.query(`select sort_order from subjects where id = $1`, [etc])).rows[0].sort_order, null, "새로 넣은 과목은 전체수업에 나옴");
  const pub = (await latest(db)).filter((r) => r.sheet_name === "컴수원_전체수업" && r.data.values[2] === "라이노");
  assert.deepEqual(JSON.parse(pub[0].data.values[25]), { 건축: 0, 인테리어: 0 });
  await as(db, "authenticated", HEAD);
  await assert.rejects(db.query(`select comsw_v4_save_department_layout($1, $2::uuid[])`, [d1, [rhino, rhino]]), /두 번/);
});

test("마이그레이션: 실행 전 깨끗했으면 공개 순서 칸까지 바로 공개(그 뒤 V4 확정이 멈추지 않음)", async () => {
  const { db } = await setup({ before: true });
  await as(db, null);
  await runMigration(db, LAST);
  await as(db, "authenticated", HEAD);
  assert.equal((await db.query(`select comsw_v4_unpublished() u`)).rows[0].u, false);
});
