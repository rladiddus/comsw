import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readRawFolder } from "../migrate/run.mjs";
import { freshDb, seeded, as } from "./pg.mjs";
import { toImportPayload } from "../migrate/to-sql.mjs";
import { transform } from "../migrate/transform.mjs";
import { SAMPLE_ROWS } from "./fixtures.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };
const HEAD = { sub: "h", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "t", role: "authenticated", comsw_role: "teacher" };
const run = (db, payload) => db.query(`select comsw_import($1::jsonb) as r`, [JSON.stringify(payload)]);
const count = async (db, t) => (await db.query(`select count(*)::int c from ${t}`)).rows[0].c;

test("가져오기는 모델과 같은 개수를 넣고 개수를 돌려준다", async () => {
  const db = await freshDb();
  const model = transform(SAMPLE_ROWS);
  await as(db, "authenticated", ADMIN);
  const { r } = (await run(db, toImportPayload(model))).rows[0];
  await as(db, null);
  assert.equal(r.subjects, model.subjects.length);
  assert.equal(await count(db, "subjects"), model.subjects.length);
  assert.equal(await count(db, "subject_weeks"), model.weeks.length);
  assert.equal(await count(db, "seminar_applications"), model.applications.length);
  assert.equal(await count(db, "site_settings"), 3);
});

test("다시 가져오면 갈아끼운다 (늘어나지 않음)", async () => {
  const db = await seeded();
  const before = await count(db, "instructor_curricula");
  await as(db, "authenticated", HEAD);
  await run(db, toImportPayload(transform(SAMPLE_ROWS)));
  await as(db, null);
  assert.equal(await count(db, "instructor_curricula"), before);
});

test("선생님·익명은 가져올 수 없다", async () => {
  const db = await seeded();
  const payload = toImportPayload(transform(SAMPLE_ROWS));
  await as(db, "authenticated", TEACHER);
  await assert.rejects(run(db, payload), /가져오기 권한이 없습니다/);
  await as(db, "authenticated", { sub: "x", role: "authenticated" });
  await assert.rejects(run(db, {}), /가져오기 권한이 없습니다/, "등급 클레임이 없는 로그인 사용자");
  await as(db, null);
  assert.ok(await count(db, "subjects") > 0);
  await as(db, "anon");
  await assert.rejects(run(db, payload));
});

test("중간에 실패하면 기존 데이터가 그대로 남는다", async () => {
  const db = await seeded();
  const before = await count(db, "subjects");
  const payload = toImportPayload(transform(SAMPLE_ROWS));
  payload.course_prep_items[0].category = "잘못된 값";
  await as(db, "authenticated", ADMIN);
  await assert.rejects(run(db, payload));
  await as(db, null);
  assert.equal(await count(db, "subjects"), before);
});

test("모르는 표 이름은 무시한다", async () => {
  const db = await freshDb();
  await as(db, "authenticated", ADMIN);
  const { r } = (await run(db, { ...toImportPayload(transform(SAMPLE_ROWS)), site_snapshots: [{ rows: "[]" }] })).rows[0];
  await as(db, null);
  assert.equal(r.site_snapshots, undefined);
  assert.equal(await count(db, "site_snapshots"), 0);
});

const RAW = "E:/바이브코딩/컴수원-관리플랫폼/research";
test("실데이터 크기에서도 동작", { skip: !existsSync(`${RAW}/raw_0.json`) }, async () => {
  const model = transform(readRawFolder(RAW));
  const db = await freshDb();
  await as(db, "authenticated", ADMIN);
  await run(db, toImportPayload(model));
  await as(db, null);
  assert.equal(await count(db, "instructor_curricula"), model.instructor_curricula.length);
});
