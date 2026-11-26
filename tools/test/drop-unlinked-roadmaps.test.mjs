// 연결 안 된 로드맵 지우기(20261126010000): 학과 없는 줄만 보관 뒤 지우고, 깨끗했으면 바로 공개.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, runMigration } from "./pg.mjs";

const FILE = "20261126010000_drop_unlinked_roadmaps.sql";

test("학과와 연결되지 않은 로드맵 줄만 보관한 뒤 지우고, 공개 상태가 깨끗했으면 새로 공개", async () => {
  const db = await freshDb(FILE);
  const { rows: [d] } = await db.query(`insert into departments (name) values ('사무 자격증') returning id`);
  const { rows: [s] } = await db.query(`insert into subjects (name) values ('모스') returning id`);
  const track = async (name, dept) => {
    const { rows: [t] } = await db.query(`insert into roadmap_tracks (name, department_id) values ($1, $2) returning id`, [name, dept]);
    const { rows: [st] } = await db.query(`insert into roadmap_steps (track_id, position, summary) values ($1, 1, $2) returning id`, [t.id, `${name} 문구`]);
    await db.query(`insert into roadmap_step_subjects (step_id, subject_id) values ($1, $2)`, [st.id, s.id]);
    return t.id;
  };
  const keep = await track("자격증학과", d.id);
  await track("사무 자격증", null);
  await track("건축/기계 자격증", null);
  await db.query(`insert into site_snapshots (published_by, rows) values ('t', comsw_build_rows())`);
  const before = (await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n;

  await runMigration(db, FILE);

  const { rows: left } = await db.query(`select id, name from roadmap_tracks`);
  assert.deepEqual(left, [{ id: keep, name: "자격증학과" }], "연결된 줄만 남음");
  assert.equal((await db.query(`select count(*)::int n from roadmap_steps`)).rows[0].n, 1, "지운 줄의 단계도 함께 지움");
  assert.equal((await db.query(`select count(*)::int n from subjects`)).rows[0].n, 1, "과목은 그대로");
  const { rows: kept } = await db.query(`select track_name, rows from comsw_private.roadmap_track_backup order by track_name`);
  assert.deepEqual(kept.map((r) => r.track_name), ["건축/기계 자격증", "사무 자격증"]);
  assert.deepEqual(kept[1].rows, [{ position: 1, summary: "사무 자격증 문구", source_text: null, subjects: ["모스"] }]);
  assert.equal((await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n, before + 1, "깨끗했으면 바로 공개");
  const published = JSON.stringify((await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows);
  assert.ok(published.includes("자격증학과") && !published.includes("건축/기계 자격증"));

  await runMigration(db, FILE); // 다시 실행해도 문제없음(지울 것 없음)
  assert.equal((await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n, before + 1);
});

test("반영 안 된 다른 변경이 있으면 지우기만 하고 공개는 하지 않음([같이 반영]으로)", async () => {
  const db = await freshDb(FILE);
  await db.query(`insert into site_snapshots (published_by, rows) values ('t', comsw_build_rows())`);
  await db.query(`insert into departments (name) values ('반영 안 된 학과')`);
  await db.query(`insert into roadmap_tracks (name) values ('옛 줄')`);
  await runMigration(db, FILE);
  assert.equal((await db.query(`select count(*)::int n from roadmap_tracks`)).rows[0].n, 0);
  assert.equal((await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n, 1, "공개는 하지 않음");
});
