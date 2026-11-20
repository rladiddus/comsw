// V4 로드맵(20261119040000): 학과 구성 순서 그대로만 저장, [+]로 합친 단계, 공개 이름 'AI웹툰 1~3'·줄바꿈.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };

test("로드맵: 학과 구성 순서대로만, 합친 단계는 한 칸, 이름 끝 숫자만 다르면 '이름 1~3', 예전 단계 보관", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d = await one(`insert into departments(name) values ('웹툰학과') returning id`);
  const ids = [];
  for (const [n, name] of ["AI웹툰1", "AI웹툰2", "AI웹툰3", "AI포토샵", "AI일러스트", "포트폴리오"].entries()) {
    const s = await one(`insert into subjects(name, sort_order) values ($1, $2) returning id`, [name, n]);
    await db.query(`insert into subject_departments(subject_id, department_id, sort_order) values ($1, $2, $3)`, [s, d, n]);
    ids.push(s);
  }
  const t = await one(`insert into roadmap_tracks(name, department_id) values ('웹툰학과', $1) returning id`, [d]);
  await db.query(`insert into roadmap_steps(track_id, position, summary) values ($1, 1, '옛 단계')`, [t]);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const save = (groups) => db.query(`select comsw_v4_save_roadmap($1, $2::jsonb)`, [d, JSON.stringify(groups)]);
  await assert.rejects(save([{ subjects: [ids[1], ids[0]] }]), /학과 구성 순서와 다릅니다/, "순서를 바꾸거나 빠뜨리면 안 됨");
  await save([
    { subjects: ids.slice(0, 3), summary: "웹툰 기초\n웹툰 완성" },
    { subjects: [ids[3], ids[4]], summary: "툴 익히기" },
    { subjects: [ids[5]], summary: "" },
  ]);
  await as(db, null);
  const snap = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  const lines = snap.filter((r) => r.sheet_name === "로드맵").map((r) => r.data.values);
  assert.deepEqual(lines[0], ["웹툰학과", "AI웹툰 1~3", "AI포토샵, AI일러스트", "포트폴리오"]);
  assert.deepEqual(lines[2], ["웹툰학과", "웹툰 기초\n웹툰 완성", "툴 익히기", ""]);
  assert.equal((await db.query(`select rows from v4_roadmap_archive`)).rows[0].rows[0].summary, "옛 단계");
});

test("공개 이름 규칙", async () => {
  const db = await freshDb();
  const label = async (c) => (await db.query(`select comsw_private.v4_roadmap_label($1) l`, [c])).rows[0].l;
  assert.equal(await label("캐드1, 캐드2"), "캐드 1~2");
  assert.equal(await label("라이노 1, 라이노 2, 라이노 3"), "라이노 1~3");
  assert.equal(await label("AI포토샵, AI일러스트"), "AI포토샵, AI일러스트");
  assert.equal(await label("캐드1"), "캐드1", "하나면 그대로");
  assert.equal(await label("캐드1, 라이노2"), "캐드1, 라이노2");
  assert.equal(await label(""), "");
});

test("로드맵 순서 따로(20261120020000): p_custom이면 같은 과목끼리 순서 자유, 빠지거나 겹치면 막음, 표시 저장", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d = await one(`insert into departments(name) values ('모션학과') returning id`);
  const ids = [];
  for (const [n, name] of ["A", "B", "C"].entries()) {
    const s = await one(`insert into subjects(name, sort_order) values ($1, $2) returning id`, [name, n]);
    await db.query(`insert into subject_departments(subject_id, department_id, sort_order) values ($1, $2, $3)`, [s, d, n]);
    ids.push(s);
  }
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const save = (groups, custom) => db.query(`select comsw_v4_save_roadmap($1, $2::jsonb, $3)`, [d, JSON.stringify(groups), custom]);
  await assert.rejects(save([{ subjects: [ids[2], ids[0], ids[1]] }], false), /학과 구성 순서와 다릅니다/, "기본은 학과 구성 순서만");
  await assert.rejects(save([{ subjects: [ids[2], ids[0]] }], true), /빠지거나 더해진/);
  await assert.rejects(save([{ subjects: [ids[2], ids[0], ids[0]] }], true), /빠지거나 더해진/);
  await save([{ subjects: [ids[2]] }, { subjects: [ids[0], ids[1]] }], true);
  await as(db, null);
  assert.equal((await db.query(`select custom_order from roadmap_tracks where department_id = $1`, [d])).rows[0].custom_order, true);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_v4_save_roadmap($1, $2::jsonb)`, [d, JSON.stringify([{ subjects: ids }])]);
  await as(db, null);
  assert.equal((await db.query(`select custom_order from roadmap_tracks where department_id = $1`, [d])).rows[0].custom_order, false, "두 인자로 부르면 학과 순서(동기화)");
});

test("타학과 동기화(20261120030000): 고른 단계 문구를 과목 묶음이 똑같은 다른 학과 단계에도, 묶음이 다르면 그대로", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const [d1, d2] = [await one(`insert into departments(name) values ('모션') returning id`), await one(`insert into departments(name) values ('시각') returning id`)];
  const ids = [];
  for (const [n, name] of ["AI포토샵", "AI일러스트", "프리미어"].entries()) {
    const s = await one(`insert into subjects(name, sort_order) values ($1, $2) returning id`, [name, n]);
    for (const d of [d1, d2]) await db.query(`insert into subject_departments(subject_id, department_id, sort_order) values ($1, $2, $3)`, [s, d, n]);
    ids.push(s);
  }
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const save = (d, groups, sync) => db.query(`select comsw_v4_save_roadmap($1, $2::jsonb, false, $3::jsonb)`, [d, JSON.stringify(groups), JSON.stringify(sync)]);
  await save(d2, [{ subjects: [ids[0], ids[1]], summary: "시각 문구" }, { subjects: [ids[2]], summary: "시각 프리미어" }], []);
  await save(d1, [{ subjects: [ids[0], ids[1]], summary: "모션 새 문구" }, { subjects: [ids[2]], summary: "모션 프리미어" }], [1]);
  await as(db, null);
  const sums = (await db.query(`select st.summary from roadmap_steps st join roadmap_tracks t on t.id = st.track_id where t.department_id = $1 order by st.position`, [d2])).rows.map((r) => r.summary);
  assert.deepEqual(sums, ["모션 새 문구", "시각 프리미어"], "1단계만 동기화");
  const snap = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  assert.ok(snap.some((r) => r.sheet_name === "로드맵" && r.data.values[0] === "시각" && r.data.values.includes("모션 새 문구")), "함께 공개");
});
