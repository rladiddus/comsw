// 20261123010000: 학과 순서·공개, 과목 이름 바꾸기, 메뉴 켜기·끄기, 강사 직접 추가·수정 — 모두 바로 공개, 선생님 불가.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };
const snap = async (db) => { await as(db, null); const r = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows; await as(db, "authenticated", HEAD); return r; };

test("학과 순서·공개, 과목 이름, 메뉴 켜기·끄기", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const a = await one(`insert into departments(name, sort_order) values ('가학과', 0) returning id`);
  const b = await one(`insert into departments(name, sort_order) values ('나학과', 1) returning id`);
  const g = await one(`insert into subjects(name, sort_order) values ('포토샵', 0) returning id`);
  await one(`insert into subjects(name, is_vacation) values ('일러스트', true) returning id`);
  const m = await one(`insert into menus(name, side, sort_order) values ('로드맵', 'left', 0) returning id`);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  await db.query(`select comsw_v4_save_departments($1::jsonb)`, [JSON.stringify([{ id: a, sort_order: 1, is_active: false }, { id: b, sort_order: 0, is_active: true }])]);
  const rows = await snap(db);
  const depts = rows.filter((r) => r.sheet_name === "컴수원_전체수업" && r.data.values[14]).map((r) => [r.data.values[14], r.data.values[16]]);
  assert.deepEqual(depts, [["나학과", "true"], ["가학과", "false"]], "순서·공개가 공개 자료에");
  await assert.rejects(db.query(`select comsw_v4_rename_subject($1, '')`, [g]), /1~60자/);
  await db.query(`select comsw_v4_rename_subject($1, '일러스트')`, [g]); // 방학 특강 과목과 이름 같아도 일반 과목끼리는 안 겹침
  await assert.rejects(db.query(`select comsw_v4_save_menus($1::jsonb)`, [JSON.stringify([{ id: m, side: "up", sort_order: 0, is_active: true }])]), /메뉴/);
  await db.query(`select comsw_v4_save_menus($1::jsonb)`, [JSON.stringify([{ id: m, label: "길잡이", side: "right", sort_order: 0, is_active: false }])]);
  const menu = (await snap(db)).find((r) => r.sheet_name === "메인 페이지" && r.data.values[4] === "로드맵").data.values;
  assert.deepEqual([menu[5], menu[6]], ["false", "오른쪽"], "꺼진 메뉴는 공개 자료에 false(홈페이지가 숨김)");
  await as(db, null);
  assert.equal((await db.query(`select name from subjects where id = $1`, [g])).rows[0].name, "일러스트");
  await as(db, "authenticated", { sub: "t", role: "authenticated", comsw_role: "teacher" });
  await assert.rejects(db.query(`select comsw_v4_rename_subject($1, '몰래')`, [g]), /권한/);
});

test("강사 직접 추가·수정: 학과·과목 연결 그대로, 메인 학과는 남은 학과 안에서만, 바로 공개", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const a = await one(`insert into departments(name) values ('가학과') returning id`);
  const b = await one(`insert into departments(name) values ('나학과') returning id`);
  const s = await one(`insert into subjects(name) values ('포토샵') returning id`);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const save = (id, p) => db.query(`select comsw_v4_save_instructor($1, $2::jsonb) id`, [id, JSON.stringify(p)]).then((r) => r.rows[0].id);
  await assert.rejects(save(null, { name: "" }), /1~30자/);
  await assert.rejects(save(null, { name: "김강사", photo_url: "javascript:x" }), /사진 주소/);
  const i = await save(null, { name: "김강사", career: "경력", message: "안녕", is_listed: true, departments: [a, b], subjects: [s] });
  let page = (await snap(db)).filter((r) => r.sheet_name === "강사페이지").map((r) => r.data.values);
  assert.deepEqual(page.map((v) => [v[0], v[1], v[2], v[3], v[4]]), [["김강사", "가학과, 나학과", "포토샵", "경력", "안녕"]]);
  await as(db, null);
  await db.query(`update instructors set main_department_ids = array[$1::uuid, $2::uuid] where id = $3`, [a, b, i]);
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  await save(i, { name: "김강사", career: "새 경력", message: "", is_listed: true, departments: [b], subjects: [] });
  await as(db, null);
  const r = (await db.query(`select career, message, main_department_ids from instructors where id = $1`, [i])).rows[0];
  assert.deepEqual([r.career, r.message, r.main_department_ids], ["새 경력", null, [b]]);
});
