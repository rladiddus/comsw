// 학과 탭 두 줄(20261117010000): 적용 행에 '학과 탭' 시트(1행 1칸 = 윗줄 개수), 값이 없으면 빈 칸(사이트 기본 5개).
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const tabCell = async (db) => {
  await as(db, null);
  const { rows: [{ rows }] } = await db.query(`select comsw_build_rows() rows`);
  const tab = rows.filter((r) => r.sheet_name === "학과 탭");
  assert.equal(tab.length, 1);
  assert.equal(tab[0].source_id, "main");
  return tab[0].data.values[0];
};

test("학과 탭 시트: 설정이 없으면 빈 칸, 저장하면 그 개수, 다른 시트는 그대로", async () => {
  const db = await seeded();
  assert.equal(await tabCell(db), "");
  await db.query(`insert into site_settings values ('dept_tab_top', '4')`);
  assert.equal(await tabCell(db), "4");
  const { rows: [{ rows }] } = await db.query(`select comsw_build_rows() rows`);
  assert.ok(rows.some((r) => r.sheet_name === "컴수원_전체수업"), "기존 시트 유지");
});

test("학과 탭 시트는 미리보기·공개 함수로만 읽힌다(직접 실행 막힘)", async () => {
  const db = await seeded();
  await as(db, "anon");
  await assert.rejects(db.query(`select comsw_build_rows()`), /permission/);
  await assert.rejects(db.query(`select comsw_build_rows_before_dept_tabs()`), /permission/);
});
