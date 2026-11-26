// V4 로드맵 학과 순서(20261126020000): 탭 순서 = 홈페이지 로드맵 위→아래, 새 줄은 겹치면 맨 아래.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };

test("로드맵 학과 순서: 받은 학과 순서대로 줄 순서를 바꾸고 바로 공개, 새 줄은 겹치면 맨 아래, 학과장만", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const [a, b, c] = [await one(`insert into departments(name, sort_order) values ('가학과', 0) returning id`),
    await one(`insert into departments(name, sort_order) values ('나학과', 1) returning id`),
    await one(`insert into departments(name, sort_order) values ('다학과', 2) returning id`)];
  await db.query(`insert into roadmap_tracks(name, department_id, sort_order) values ('가학과', $1, 0), ('나학과', $2, 1)`, [a, b]);
  await db.query(`insert into site_snapshots(published_by, rows) values ('t', comsw_build_rows())`);
  await as(db, "authenticated", { sub: "uid-t", role: "authenticated", comsw_role: "teacher" });
  await assert.rejects(db.query(`select comsw_v4_save_roadmap_order($1)`, [[b, a]]), /권한/);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_v4_save_roadmap_order($1)`, [[c, b, a]]);
  await as(db, null);
  const order = async () => (await db.query(`select name, sort_order from roadmap_tracks order by sort_order`)).rows.map((r) => `${r.name}:${r.sort_order}`);
  assert.deepEqual(await order(), ["나학과:1", "가학과:2"], "줄이 없는 학과(다학과)는 자리만 차지");
  const { rows: pub } = await db.query(`select distinct on (r->'data'->'values'->>0) r->'data'->'values'->>0 name, o
    from site_snapshots s, jsonb_array_elements(s.rows) with ordinality x(r, o)
    where s.id = (select max(id) from site_snapshots) and r->>'sheet_name' = '로드맵' order by r->'data'->'values'->>0, o`);
  assert.deepEqual(pub.sort((x, y) => Number(x.o) - Number(y.o)).map((r) => r.name), ["나학과", "가학과"], "바로 공개(나학과가 위)");
  await db.query(`insert into roadmap_tracks(name, department_id, sort_order) values ('다학과', $1, 1)`, [c]);
  assert.deepEqual(await order(), ["나학과:1", "가학과:2", "다학과:3"], "겹치는 순서로 새로 만들면 맨 아래");
});
