// 메뉴 이름 고치기(20261118010000): '메인 페이지' 메뉴 행 K열(10) = menus.label, 없으면 빈 칸. E열(원래 이름)은 그대로.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const menuRows = async (db) => {
  await as(db, null);
  const { rows: [{ rows }] } = await db.query(`select comsw_build_rows() rows`);
  return rows.filter((r) => r.sheet_name === "메인 페이지").map((r) => r.data.values);
};

test("메뉴 행 K열 = 고친 이름, 안 고쳤으면 빈 칸, E열은 원래 이름", async () => {
  const db = await seeded();
  await db.query(`insert into menus (name, side, sort_order) values ('시험메뉴A', 'left', 1), ('시험메뉴B', 'right', 2)`);
  await db.query(`update menus set label = '고친 이름' where name = '시험메뉴A'`);
  const rows = await menuRows(db);
  const row = (n) => rows.find((v) => v[4] === n);
  assert.equal(row("시험메뉴A")[10], "고친 이름");
  assert.equal(row("시험메뉴B")[10], "");
  assert.ok(rows.filter((v) => !v[4]).every((v) => v.length === 10), "메뉴 없는 행은 그대로");
});

test("직접 실행 막힘", async () => {
  const db = await seeded();
  await as(db, "anon");
  await assert.rejects(db.query(`select comsw_build_rows_before_menu_labels()`), /permission/);
});
