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
