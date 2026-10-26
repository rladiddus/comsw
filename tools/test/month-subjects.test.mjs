// '+ 개월 추가': 원래 과목 이름 + 숫자로 다음 달 과목을 만들고 같은 학과에 연결(승인 전 신규 과목).
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };

test("다음 달 과목은 원래 과목의 학과에 순서 없이 생기고, 같은 이름이면 그 과목을 돌려준다", async () => {
  const db = await seeded();
  await as(db, null);
  const { rows: [d] } = await db.query(`select id from departments limit 1`);
  const { rows: [s] } = await db.query(`insert into subjects(name, duration, sort_order) values ('웹툰1', '1개월', 99) returning id`);
  await db.query(`insert into subject_departments values ($1, $2)`, [s.id, d.id]);
  await as(db, "authenticated", TEACHER);
  const { rows: [{ id }] } = await db.query(`select comsw_create_month_subject($1, '웹툰2') id`, [s.id]);
  const { rows: [{ id: again }] } = await db.query(`select comsw_create_month_subject($1, '웹툰2') id`, [s.id]);
  assert.equal(again, id);
  await as(db, null);
  const { rows: [made] } = await db.query(`select name, duration, sort_order from subjects where id = $1`, [id]);
  assert.deepEqual(made, { name: "웹툰2", duration: "1개월", sort_order: null });
  const { rows: links } = await db.query(`select department_id from subject_departments where subject_id = $1`, [id]);
  assert.deepEqual(links.map((l) => l.department_id), [d.id]);
  await as(db, "authenticated", TEACHER);
  await assert.rejects(db.query(`select comsw_create_month_subject($1, '포토샵2')`, [s.id]), /숫자만/);
  await as(db, "anon");
  await assert.rejects(db.query(`select comsw_create_month_subject($1, '웹툰3')`, [s.id]));
});
