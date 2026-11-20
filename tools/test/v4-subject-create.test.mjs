// 20261120070000: 과목 생성 — 학과·과목(일반) / 방학 특강(is_vacation). 같은 이름도 종류가 다르면 다른 과목.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };

test("과목 생성: 일반·방학 특강 따로, 같은 종류 안에서만 이름 중복 막음, 방학 특강은 학과 커리큘럼에 안 들어감, 준비물은 일반끼리", async () => {
  const db = await freshDb();
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const make = (n, v) => db.query(`select comsw_v4_create_subject($1, $2) id`, [n, v]).then((r) => r.rows[0].id);
  const g = await make(" 포토샵 ", false);
  const v = await make("포토샵", true);
  assert.notEqual(g, v, "이름이 같아도 다른 과목");
  await assert.rejects(make("포토샵", true), /같은 이름의 방학 특강 과목/);
  await assert.rejects(make("포토샵", false), /같은 이름의 일반 과목/);
  await assert.rejects(make("", false), /1~60자/);
  await as(db, null);
  const rows = (await db.query(`select name, is_vacation, sort_order from subjects order by is_vacation`)).rows;
  assert.deepEqual(rows.map((r) => [r.name, r.is_vacation, r.sort_order === null]), [["포토샵", false, false], ["포토샵", true, true]]);
  const snap = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  assert.equal(snap.filter((r) => r.sheet_name === "컴수원_전체수업" && r.data.values[2] === "포토샵").length, 1, "방학 특강 과목은 학과 커리큘럼에 없음");
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_v4_confirm_prep('포토샵', '[{"category":"supply","content":"마우스"}]'::jsonb)`);
  await as(db, null);
  const prep = (await db.query(`select subject_id from course_prep_items`)).rows.map((r) => r.subject_id);
  assert.deepEqual(prep, [g], "준비물은 일반 과목만");
  await as(db, "authenticated", { sub: "t", role: "authenticated", comsw_role: "teacher" });
  await assert.rejects(make("몰래", false), /권한/);
});
