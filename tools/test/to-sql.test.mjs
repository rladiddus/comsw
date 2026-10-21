import test from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./pg.mjs";
import { sqlLiteral, toSql, toSqlChunks } from "../migrate/to-sql.mjs";
import { isInsideRepo } from "../migrate/run.mjs";
import { transform } from "../migrate/transform.mjs";
import { SAMPLE_ROWS } from "./fixtures.mjs";

test("문자열의 작은따옴표·줄바꿈·$$·이모지를 그대로 보존한다", async () => {
  const db = await freshDb();
  const text = "it's\n$$ drop table x; $$ 😀 \\n";
  await db.query(`insert into menus(name) values (${sqlLiteral(text)})`);
  assert.equal((await db.query(`select name from menus`)).rows[0].name, text);
});

test("줄바꿈·탭·역슬래시는 SQL 파일에 그대로 쓰지 않고 이스케이프한다 (붙여넣기 중 변형 방지)", async () => {
  const text = "첫 줄\r\n둘째\n셋째\t탭 \\ 역슬래시 it's";
  const lit = sqlLiteral(text);
  assert.ok(!/[\r\n\t]/.test(lit), lit);
  const db = await freshDb();
  await db.query(`insert into menus(name) values (${lit})`);
  assert.equal((await db.query(`select name from menus`)).rows[0].name, text);
});

test("null·불리언·숫자", () => {
  assert.equal(sqlLiteral(null), "null");
  assert.equal(sqlLiteral(undefined), "null");
  assert.equal(sqlLiteral(false), "false");
  assert.equal(sqlLiteral(3), "3");
});

test("변환 결과를 넣고 다시 넣어도 같은 개수다", async () => {
  const db = await freshDb();
  const model = transform(SAMPLE_ROWS);
  const sql = toSql(model);
  await db.exec(sql);
  await db.exec(sql);
  const count = async t => (await db.query(`select count(*)::int c from ${t}`)).rows[0].c;
  assert.equal(await count("subjects"), model.subjects.length);
  assert.equal(await count("subject_weeks"), model.weeks.length);
  assert.equal(await count("instructors"), model.instructors.length);
  assert.equal(await count("instructor_curricula"), model.instructor_curricula.length);
  assert.equal(await count("roadmap_steps"), model.roadmap_tracks.reduce((n, t) => n + t.steps.length, 0));
  assert.equal(await count("seminar_applications"), model.applications.length);
  assert.equal(await count("recruitment_posts"), model.recruitment.length);
  assert.equal((await db.query(`select company from recruitment_posts`)).rows[0].company, "회사");
  const vac = (await db.query(`select s.name from site_settings v join curriculum_sets s on s.id::text = v.value where v.key = 'vacation_set_id'`)).rows;
  assert.deepEqual(vac.map(x => x.name), ["2026년 여름방학특강"]);
});

test("재실행해도 적용 기록(스냅샷)은 지우지 않는다", async () => {
  const db = await freshDb();
  await db.exec(`insert into site_snapshots(rows) values ('[]')`);
  await db.exec(toSql(transform(SAMPLE_ROWS)));
  assert.equal((await db.query(`select count(*)::int c from site_snapshots`)).rows[0].c, 1);
});

test("SQL Editor에 붙여넣을 수 있게 조각마다 글자 수 한도 이하로 나눈다", async () => {
  const model = transform(SAMPLE_ROWS);
  const chunks = toSqlChunks(model, { maxChars: 1500 });
  assert.ok(chunks.length > 2);
  for (const c of chunks) assert.ok(c.length <= 1500, `조각 길이 ${c.length}`);
  assert.match(chunks[0], /truncate/);
  const db = await freshDb();
  for (let round = 0; round < 2; round++) for (const c of chunks) await db.exec(c);
  const count = async t => (await db.query(`select count(*)::int c from ${t}`)).rows[0].c;
  assert.equal(await count("subjects"), model.subjects.length);
  assert.equal(await count("instructor_curricula"), model.instructor_curricula.length);
  assert.equal(await count("site_settings"), 3);
});

test("한 줄이 한도보다 길면 그 줄 하나만 담은 조각을 만든다", () => {
  const model = transform(SAMPLE_ROWS);
  model.menus[0].name = "가".repeat(3000);
  const chunks = toSqlChunks(model, { maxChars: 1500 });
  assert.ok(chunks.some(c => c.includes("가".repeat(3000))));
});

test("저장소 안 경로는 거부한다", () => {
  assert.equal(isInsideRepo("E:/x/comsw/data.sql", "E:/x/comsw"), true);
  assert.equal(isInsideRepo("E:/x/comsw/sub/data.sql", "E:/x/comsw"), true);
  assert.equal(isInsideRepo("E:/x/research/data.sql", "E:/x/comsw"), false);
  assert.equal(isInsideRepo("E:/x/comsw-other/data.sql", "E:/x/comsw"), false);
});
