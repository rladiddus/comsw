// 옵저버(20261127010000): 공개 자료와 AI 사용량은 읽고, 민감 정보와 저장은 막힘.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const OBS = { sub: "obs1", role: "authenticated", comsw_role: "observer" };

test("옵저버: 공개 자료·AI 사용량은 읽고, 신청자·강사 제출본·임시 저장·상담 평가·AI 프롬프트는 못 읽고, 저장 함수는 거절", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d = await one(`insert into departments(name) values ('시각편집학과') returning id`);
  const s = await one(`insert into subjects(name) values ('AI포토샵') returning id`);
  await db.query(`insert into subject_departments(subject_id, department_id) values ($1, $2)`, [s, d]);
  const sem = await one(`insert into seminars(title) values ('특강') returning id`);
  await db.query(`insert into seminar_applications(seminar_id, name, phone) values ($1, '홍길동', '010-1111-2222')`, [sem]);
  const i = await one(`insert into instructors(name) values ('김강사') returning id`);
  await db.query(`insert into instructor_profile_drafts(instructor_id, status) values ($1, 'pending')`, [i]).catch(() => {});
  await db.query(`insert into site_settings(key, value) values ('ai_prompt_week', '비밀 지시문'), ('dept_tab_top', '5')`);
  await db.query(`insert into v4_drafts(kind, target, payload) values ('ui', 'x', '{}')`).catch(() => {});
  await db.query(`insert into site_snapshots(published_by, rows) values ('t', comsw_build_rows())`);
  await db.query(`select comsw_chat_feedback_add('w', 5, '', '[{"role":"user","content":"q"}]'::jsonb)`);

  await as(db, "authenticated", OBS);
  const count = async (t) => (await db.query(`select count(*)::int n from ${t}`)).rows[0].n;
  assert.equal(await count("departments"), 1);
  assert.equal(await count("subjects"), 1);
  assert.equal(await count("subject_departments"), 1);
  assert.equal(await count("seminars"), 1, "특강 정보는 보임");
  assert.equal(await count("instructors"), 1);
  assert.equal(await count("seminar_applications"), 0, "신청자는 안 보임");
  assert.equal(await count("instructor_profile_drafts"), 0, "강사 제출본은 안 보임");
  assert.equal(await count("v4_drafts"), 0, "임시 저장함은 안 보임");
  assert.deepEqual((await db.query(`select key from site_settings order by key`)).rows.map((r) => r.key), ["dept_tab_top"], "AI 프롬프트는 안 보임");
  assert.equal((await db.query(`select comsw_ai_budget() b`)).rows[0].b.limit > 0, true, "AI 사용량은 보임");
  assert.equal((await db.query(`select comsw_chat_budget() b`)).rows[0].b.count, 0);
  await assert.rejects(db.query(`select comsw_chat_feedback_list()`), /권한/, "상담 평가는 안 보임");
  await assert.rejects(db.query(`select comsw_v4_save_departments('[]'::jsonb)`), /권한/, "저장 함수는 거절");
  await assert.rejects(db.query(`update departments set name = 'x'`).then((r) => { if (r.affectedRows) throw new Error("바뀜"); throw new Error("권한 없음(0줄)"); }), /권한 없음|permission/);
  await assert.rejects(db.query(`insert into departments(name) values ('새학과')`), /row-level security|permission/);
  // 다른 역할은 그대로
  await as(db, "authenticated", { sub: "t1", role: "authenticated", comsw_role: "teacher" });
  assert.equal(await count("seminar_applications"), 0);
  await as(db, "authenticated", { sub: "h1", role: "authenticated", comsw_role: "head" });
  assert.equal(await count("seminar_applications"), 1, "학과장은 그대로 봄");
  assert.equal((await db.query(`select count(*)::int n from site_settings`)).rows[0].n, 2);
});
