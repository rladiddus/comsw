// 홈페이지 로드맵 학과 이름 = 학과 이름(20261126030000): 한 번 맞추고, 학과 이름을 바꾸면 같이 바뀜.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, runMigration } from "./pg.mjs";

const FILE = "20261126030000_roadmap_track_dept_name.sql";

test("로드맵 줄 이름을 학과 이름으로 맞추고 바로 공개, 이후 학과 이름을 바꾸면 같이 바뀜(학과 탭·옛 이름 기억은 그대로)", async () => {
  const db = await freshDb(FILE);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d1 = await one(`insert into departments(name, sort_order) values ('건축·기계 자격증', 0) returning id`);
  const d2 = await one(`insert into departments(name, sort_order) values ('사무 자격증', 1) returning id`);
  await db.query(`insert into roadmap_tracks(name, department_id, sort_order) values ('건축·기계', $1, 0), ('자격증학과', $2, 1)`, [d1, d2]);
  await db.query(`insert into site_snapshots(published_by, rows) values ('t', comsw_build_rows())`);
  const before = (await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n;

  await runMigration(db, FILE);

  const names = async () => (await db.query(`select name from roadmap_tracks order by sort_order`)).rows.map((r) => r.name);
  assert.deepEqual(await names(), ["건축·기계 자격증", "사무 자격증"]);
  assert.equal((await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n, before + 1, "깨끗했으면 바로 공개");
  const snap = JSON.stringify((await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows);
  assert.ok(!snap.includes("자격증학과"), "공개본에 옛 이름 없음");

  await db.query(`insert into curriculum_sets(name, department_id) values ('사무 자격증', $1)`, [d2]);
  await db.query(`update departments set name = '사무·회계 자격증' where id = $1`, [d2]);
  assert.deepEqual(await names(), ["건축·기계 자격증", "사무·회계 자격증"], "학과 이름을 바꾸면 로드맵 이름도");
  assert.equal((await db.query(`select name from curriculum_sets where department_id = $1`, [d2])).rows[0].name, "사무·회계 자격증", "학과 탭도 그대로 따라감");
  assert.deepEqual((await db.query(`select former_names from departments where id = $1`, [d2])).rows[0].former_names, ["사무 자격증"]);

  await runMigration(db, FILE); // 다시 실행해도 문제없음
  assert.equal((await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n, before + 1, "맞출 것이 없으면 공개 안 함");
});
