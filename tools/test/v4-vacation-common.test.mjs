// V4 방학 특강 공통 4단계(20261119060000): 그 특강의 검수 완료본만, 확정한 과목만 강사 줄 대신 공통 4줄, 다른 과목·일반 탭은 그대로.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };

test("방학 특강 공통: 확정 전에는 공개 그대로, 확정하면 그 과목만 공통 4줄(강사 이름·시간·준비물 유지)", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const ps = await one(`insert into subjects(name) values ('포토샵1') returning id`);
  const il = await one(`insert into subjects(name) values ('일러스트1') returning id`);
  const vac = await one(`insert into curriculum_sets(name, is_vacation) values ('2026 겨울', true) returning id`);
  const gen = await one(`insert into curriculum_sets(name) values ('시각학과') returning id`);
  await db.query(`insert into vacation_set_subjects values ($1,$2),($1,$3)`, [vac, ps, il]);
  const i1 = await one(`insert into instructors(name) values ('김강사') returning id`);
  const rows = [];
  for (let n = 1; n <= 4; n++) {
    rows.push((await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, summary, media_url, class_time, supplies_detail, status, sort_order, vacation)
      values ($1,$2,$3,$4,$5,$6,$7,'월수 10시','펜','approved',$8,true) returning id, updated_at`, [vac, i1, ps, `${n}단계`, `원문${n}`, `강사요약${n}`, `https://img/${n}.webp`, n])).rows[0]);
  }
  await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status, sort_order, vacation) values ($1,$2,$3,'1단계','일러','approved',9,true)`, [vac, i1, il]);
  const genRow = (await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, status) values ($1,$2,$3,'1단계','일반','approved') returning id, updated_at`, [gen, i1, ps])).rows[0];
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  assert.equal((await db.query(`select comsw_v4_unpublished() u`)).rows[0].u, false, "공통이 없으면 공개 자료 그대로");
  const confirm = (sources, img = "") => db.query(`select comsw_v4_confirm_vacation_common($1,$2,$3::jsonb,$4::jsonb)`,
    [vac, ps, JSON.stringify(sources.map((r) => ({ id: r.id, updated_at: r.updated_at.toISOString() }))), JSON.stringify([1, 2, 3, 4].map((n) => ({ summary: `특강공통${n}`, image_url: n === 1 ? img : "" })))]);
  await assert.rejects(confirm([genRow]), /이 특강의 검수 완료본이 아니거나/, "일반 수업 자료는 못 씀");
  await assert.rejects(confirm(rows, "https://img/x.webp"), /이미지 중에서/);
  await confirm(rows, "https://img/2.webp");
  await as(db, null);
  const snap = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  const tab = snap.filter((r) => r.source_id === "instructor_curriculum" && r.sheet_name === "2026 겨울").sort((a, b) => a.row_number - b.row_number);
  assert.deepEqual(tab.map((r) => r.row_number), [2, 3, 4, 5, 6], "줄 번호 다시 매김");
  const v = tab.map((r) => r.data.values);
  assert.deepEqual(v.slice(0, 4).map((x) => [x[0], x[1], x[2], x[4], x[5], x[7], x[8]]), [1, 2, 3, 4].map((n) => ["김강사", "포토샵1", `${n}단계`, `특강공통${n}`, n === 1 ? "https://img/2.webp" : "", "펜", "월수 10시"]));
  assert.equal(v[4][1], "일러스트1", "공통 안 만든 과목은 강사 줄 그대로");
  const genTab = snap.filter((r) => r.source_id === "instructor_curriculum" && r.sheet_name === "시각학과").map((r) => r.data.values[3]);
  assert.deepEqual(genTab, ["일반"], "일반 탭은 그대로");
});
