// V4 5단계(20261119050000): 방학 특강 구성·홈페이지 특강, 특강 정보, 사이트 편집 탭별 저장(바로 공개).
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "uid-t", role: "authenticated", comsw_role: "teacher" };

async function setup() {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const ids = {
    s1: await one(`insert into subjects(name) values ('포토샵') returning id`),
    s2: await one(`insert into subjects(name) values ('일러스트') returning id`),
    d: await one(`insert into departments(name) values ('시각학과') returning id`),
    m1: await one(`insert into main_media(url, caption, sort_order) values ('https://a/1.mp4', '하나', 0) returning id`),
    m2: await one(`insert into main_media(url, caption, sort_order) values ('https://a/2.jpg', '둘', 1) returning id`),
    menu: await one(`insert into menus(name, side, sort_order) values ('전체 수업', 'right', 0) returning id`),
  };
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  return { db, ...ids };
}
const latest = async (db) => { await as(db, null); const r = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows; await as(db, "authenticated", HEAD); return r; };
const sheet = (rows, name) => rows.filter((r) => r.sheet_name === name).map((r) => r.data.values);

test("방학 특강: 만들기·과목 구성·홈페이지 특강, 빼기는 연결만", async () => {
  const { db, s1, s2 } = await setup();
  const { rows: [{ v }] } = await db.query(`select comsw_v4_save_vacation(null, '2026 겨울', $1::uuid[], true) v`, [[s1, s2]]);
  await db.query(`select comsw_v4_save_vacation($1, '2026 겨울방학', $2::uuid[], false)`, [v, [s2]]);
  await as(db, null);
  assert.deepEqual((await db.query(`select subject_id from vacation_set_subjects where set_id = $1`, [v])).rows.map((r) => r.subject_id), [s2]);
  assert.equal((await db.query(`select count(*)::int n from subjects where id = $1`, [s1])).rows[0].n, 1, "과목은 그대로");
  assert.equal((await db.query(`select value from site_settings where key = 'vacation_set_id'`)).rows[0].value, v);
  assert.equal((await db.query(`select name, is_vacation from curriculum_sets where id = $1`, [v])).rows[0].name, "2026 겨울방학");
});

test("특강: 새로 만들고 고치면 바로 공개, 포스터는 http(s)만", async () => {
  const { db } = await setup();
  await assert.rejects(db.query(`select comsw_v4_save_seminar(null, $1::jsonb)`, [JSON.stringify({ title: "x", poster_url: "javascript:alert(1)" })]), /포스터/);
  const { rows: [{ v }] } = await db.query(`select comsw_v4_save_seminar(null, $1::jsonb) v`, [JSON.stringify({ title: "AI 특강", capacity: "30", poster_url: "https://p/a.png" })]);
  await db.query(`select comsw_v4_save_seminar($1, $2::jsonb)`, [v, JSON.stringify({ title: "AI 특강", place: "3층", capacity: "30", is_listed: true })]);
  const s = sheet(await latest(db), "특강 및 세미나");
  assert.equal(s[0][1], "AI 특강");
  assert.equal(s[0][5], "3층");
});

test("사이트 편집: 메인은 여러 개 순서·빠진 것만 지움, 메뉴는 보이는 이름만(이동용 이름 그대로), 탭마다 바로 공개", async () => {
  const { db, m1, m2, menu, d } = await setup();
  await db.query(`select comsw_v4_save_site('main', $1::jsonb)`, [JSON.stringify({ items: [
    { id: m2, url: "https://a/2.jpg", caption: "둘(고침)", is_active: true }, { url: "https://a/3.jpg", caption: "셋" },
  ] })]);
  await as(db, null);
  const mm = (await db.query(`select id, caption from main_media order by sort_order`)).rows;
  assert.deepEqual(mm.map((r) => r.caption), ["둘(고침)", "셋"]);
  assert.ok(!mm.some((r) => r.id === m1), "빠진 것만 지움");
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_v4_save_site('menu', $1::jsonb)`, [JSON.stringify({ items: [{ id: menu, label: "로드맵", side: "left", sort_order: 3 }] })]);
  await db.query(`select comsw_v4_save_site('dept', $1::jsonb)`, [JSON.stringify({ id: d, image_url: "https://a/d.jpg", description: "소개" })]);
  await assert.rejects(db.query(`select comsw_v4_save_site('dept', $1::jsonb)`, [JSON.stringify({ id: d, image_url: "javascript:x" })]), /http\(s\)/);
  const rows = await latest(db);
  const menuRow = sheet(rows, "메인 페이지").find((v) => v[4] === "전체 수업");
  assert.deepEqual([menuRow[4], menuRow[6], menuRow[10]], ["전체 수업", "왼쪽", "로드맵"]);
  assert.ok(sheet(rows, "컴수원_전체수업").some((v) => v[14] === "시각학과" && v[15] === "https://a/d.jpg" && v[17] === "소개"));
});

test("선생님은 사이트·특강·방학 특강을 저장할 수 없다", async () => {
  const { db } = await setup();
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_v4_save_site('main', '{"items":[]}'::jsonb)`), /권한/);
  await assert.rejects(db.query(`select comsw_v4_save_seminar(null, '{"title":"x"}'::jsonb)`), /권한/);
  await assert.rejects(db.query(`select comsw_v4_save_vacation(null, 'x', '{}'::uuid[], false)`), /권한/);
});
