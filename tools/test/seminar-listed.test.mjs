// 특강 '공개' 체크(20261030020000): 비공개 특강은 적용 행에서 빠지고(줄 번호 다시 매김) 신청도 못 한다.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };

test("비공개 특강은 사이트 행에서 빠지고 신청을 받지 않는다, 공개 특강은 그대로", async () => {
  const db = await seeded();
  await as(db, null);
  await db.exec(`update seminars set datetime_text = '2999년 1월 1일 14:00-16:00'`);
  const { rows: [s] } = await db.query(`insert into seminars(title, datetime_text, sort_order) values ('숨긴 특강', '2999년 1월 2일', 0) returning id`);
  await db.query(`update seminars set is_listed = false where id = $1`, [s.id]);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_publish()`);
  await as(db, "anon");
  const rows = (await db.query(`select * from comsw_site_rows('main', '특강 및 세미나')`)).rows;
  assert.ok(!rows.some((r) => r.data.values[1] === "숨긴 특강"), "비공개 특강 없음");
  assert.ok(rows.some((r) => r.data.values[1] === "AI 특강"), "공개 특강은 그대로");
  assert.deepEqual(rows.map((r) => r.row_number), rows.map((_, i) => i + 2), "줄 번호 빈칸 없음");
  const r = (await db.query(`select comsw_apply_seminar($1, '이영희', '010-5555-6666') r`, [s.id])).rows[0].r;
  assert.equal(r.error, "특강을 찾을 수 없습니다");
});
