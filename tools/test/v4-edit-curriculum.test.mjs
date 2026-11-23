// 20261120050000: 학과장·관리자가 검수 완료 커리큘럼을 고침 — 문구·빈 단계 이미지, 바로 공개, 예전 것 보관, 그사이 바뀌면 멈춤, 선생님 불가.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };

test("검수 완료 커리큘럼 고치기", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d = await one(`insert into departments(name) values ('건축학과') returning id`);
  const s = await one(`insert into subjects(name) values ('캐드1') returning id`);
  await db.query(`insert into subject_departments(subject_id, department_id) values ($1, $2)`, [s, d]);
  const set = await one(`insert into curriculum_sets(name, department_id) values ('건축학과', $1) returning id`, [d]);
  const i = await one(`insert into instructors(name, is_listed) values ('김강사', true) returning id`);
  for (let n = 1; n <= 4; n++) {
    await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, media_url, status, sort_order) values ($1,$2,$3,$4,$5,$6,'approved',$7)`,
      [set, i, s, `${n}단계`, `원문 ${n}`, n === 1 ? "https://img/1.png" : null, n]);
  }
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const rows = async () => (await db.query(`select id, updated_at, step_label, summary, media_url from instructor_curricula where instructor_id = $1 order by step_label`, [i])).rows;
  const seen = (await rows()).map((r) => ({ id: r.id, updated_at: r.updated_at.toISOString(), summary: `고친 ${r.step_label}`, media_url: r.step_label === "2단계" ? "https://img/2.png" : "" }));
  const edit = (steps) => db.query(`select comsw_v4_edit_curriculum($1,$2,$3,$4::jsonb)`, [i, set, s, JSON.stringify(steps)]);
  await assert.rejects(edit(seen.slice(0, 3)), /그사이/, "줄이 모자라면 멈춤");
  await assert.rejects(edit(seen.map((x) => ({ ...x, media_url: "javascript:alert(1)" }))), /이미지 주소/);
  await edit(seen);
  const now = await rows();
  assert.deepEqual(now.map((r) => [r.summary, r.media_url]), [["고친 1단계", "https://img/1.png"], ["고친 2단계", "https://img/2.png"], ["고친 3단계", null], ["고친 4단계", null]]);
  await assert.rejects(edit(seen), /그사이/, "옛 버전으로는 다시 못 고침");
  await as(db, null);
  assert.equal((await db.query(`select count(*)::int n from v4_curricula_archive`)).rows[0].n, 1, "예전 것 보관");
  const snap = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  assert.ok(snap.some((r) => r.source_id === "instructor_curriculum" && r.data.values[4] === "고친 2단계"), "바로 공개");
  await as(db, "authenticated", { sub: "t", role: "authenticated", comsw_role: "teacher" });
  await assert.rejects(edit(seen), /권한/);
});

test("검수 완료 수정 넓히기(20261123020000): 원래 문구 고치기, 4단계 넘는 단계 지우기·번호 다시 매기기, 4단계 밑으로는 못 지움", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d = await one(`insert into departments(name) values ('AI학과') returning id`);
  const s = await one(`insert into subjects(name) values ('AI베이직') returning id`);
  const set = await one(`insert into curriculum_sets(name, department_id) values ('AI학과', $1) returning id`, [d]);
  const i = await one(`insert into instructors(name) values ('허강사') returning id`);
  for (let n = 1; n <= 6; n++) {
    await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status, sort_order) values ($1,$2,$3,$4,$5,'approved',$6)`, [set, i, s, `${n}단계`, `원문 ${n}`, n]);
  }
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const rows = async () => (await db.query(`select id, updated_at, step_label, written from instructor_curricula order by sort_order`)).rows;
  const edit = (steps) => db.query(`select comsw_v4_edit_curriculum($1,$2,$3,$4::jsonb)`, [i, set, s, JSON.stringify(steps)]);
  let r = await rows();
  const base = (x) => ({ id: x.id, updated_at: x.updated_at.toISOString(), summary: "", media_url: "" });
  await assert.rejects(edit(r.map((x, k) => ({ ...base(x), delete: k >= 3 }))), /4단계보다 적게/);
  await edit(r.map((x, k) => ({ ...base(x), written: k === 0 ? "고친 원문" : x.written, delete: k === 1 || k === 4 })));
  r = await rows();
  assert.deepEqual(r.map((x) => [x.step_label, x.written]), [["1단계", "고친 원문"], ["2단계", "원문 3"], ["3단계", "원문 4"], ["4단계", "원문 6"]]);
});

test("언제든 고치기(20261123030000): 이번 제출 1단계에 원래 문구 고치고 단계 3개 더해 4단계로 확정, 4단계 아니면 막음", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d = await one(`insert into departments(name) values ('모션학과') returning id`);
  const s = await one(`insert into subjects(name) values ('프리미어 프로') returning id`);
  const set = await one(`insert into curriculum_sets(name, department_id) values ('모션학과', $1) returning id`, [d]);
  const i = await one(`insert into instructors(name) values ('오강사') returning id`);
  await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status, sort_order) values ($1,$2,$3,'1단계','원문 1','pending',1)`, [set, i, s]);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const r = (await db.query(`select id, updated_at from instructor_curricula`)).rows[0];
  const first = { id: r.id, updated_at: r.updated_at.toISOString(), written: "고친 원문 1", summary: "요약 1", media_url: "" };
  const confirm = (steps) => db.query(`select comsw_v4_confirm_curriculum($1,$2,$3,$4::jsonb)`, [i, set, s, JSON.stringify(steps)]);
  await assert.rejects(confirm([first, { written: "새 2", summary: "", media_url: "" }]), /4단계가 되어야 확정할 수 있습니다\(지금 2단계\)/);
  await assert.rejects(confirm([first, { written: "", summary: "", media_url: "" }, { written: "a" }, { written: "b" }]), /새 단계에는 원래 문구/);
  await confirm([first, { written: "새 2", summary: "", media_url: "https://img/2.png" }, { written: "새 3", summary: "요약 3", media_url: "" }, { written: "새 4", summary: "", media_url: "" }]);
  await as(db, null);
  const got = (await db.query(`select step_label, written, summary, media_url, status from instructor_curricula order by sort_order`)).rows;
  assert.deepEqual(got.map((x) => [x.step_label, x.written, x.summary, x.media_url, x.status]), [
    ["1단계", "고친 원문 1", "요약 1", null, "approved"], ["2단계", "새 2", null, "https://img/2.png", "approved"],
    ["3단계", "새 3", "요약 3", null, "approved"], ["4단계", "새 4", null, null, "approved"]]);
  const snap = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  assert.equal(snap.filter((x) => x.source_id === "instructor_curriculum").length, 4, "바로 공개");
});
