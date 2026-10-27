// 학과 커리큘럼·학과별 과목 '저장' = comsw_save_subject_layout 한 번(전부 저장 또는 전부 안 됨).
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const HEAD = { sub: "head", role: "authenticated", comsw_role: "head" };
const TEACHER = { sub: "t", role: "authenticated", comsw_role: "teacher" };

async function setup() {
  const db = await seeded();
  await as(db, null);
  const { rows: [d1] } = await db.query(`select id from departments order by sort_order limit 1`);
  const { rows: [d2] } = await db.query(`select id from departments order by sort_order offset 1 limit 1`);
  const { rows: [a] } = await db.query(`insert into subjects(name, sort_order) values ('가과목', 900) returning id`);
  const { rows: [b] } = await db.query(`insert into subjects(name, sort_order) values ('나과목', 901) returning id`);
  await db.query(`insert into subject_departments values ($1, $2)`, [a.id, d1.id]);
  return { db, d1: d1.id, d2: d2.id, a: a.id, b: b.id };
}
const save = (db, add, subjects, remove) =>
  db.query(`select comsw_save_subject_layout($1::jsonb, $2::jsonb, $3::jsonb)`, [JSON.stringify(add), JSON.stringify(subjects), JSON.stringify(remove)]);

test("연결 추가·과목 칸·순서·연결 빼기를 한 번에, 같은 연결을 다시 넣어도 안전", async () => {
  const { db, d1, d2, a, b } = await setup();
  await as(db, "authenticated", HEAD);
  await save(db, [{ subject_id: b, department_id: d1 }, { subject_id: a, department_id: d1 }],
    [{ id: a, name: "가과목 기초", duration: "1개월", sort_order: 901 }, { id: b, sort_order: 900 }],
    [{ subject_id: a, department_id: d2 }]);
  await as(db, null);
  const { rows } = await db.query(`select id, name, duration, sort_order from subjects where id in ($1, $2) order by sort_order`, [a, b]);
  assert.deepEqual(rows, [{ id: b, name: "나과목", duration: null, sort_order: 900 }, { id: a, name: "가과목 기초", duration: "1개월", sort_order: 901 }]);
  const { rows: links } = await db.query(`select subject_id from subject_departments where department_id = $1 and subject_id in ($2, $3) order by subject_id`, [d1, a, b]);
  assert.equal(links.length, 2);
});

test("중간에 하나라도 실패하면(같은 과목명) 아무것도 저장되지 않는다", async () => {
  const { db, d1, a, b } = await setup();
  await as(db, "authenticated", HEAD);
  await assert.rejects(save(db, [{ subject_id: b, department_id: d1 }], [{ id: a, sort_order: 950 }, { id: b, name: "가과목" }], []));
  await assert.rejects(save(db, [], [{ id: a, name: "  " }], []), /과목명/);
  await as(db, null);
  const { rows: [x] } = await db.query(`select sort_order from subjects where id = $1`, [a]);
  assert.equal(x.sort_order, 900, "순서도 그대로");
  const { rows: links } = await db.query(`select 1 from subject_departments where subject_id = $1`, [b]);
  assert.equal(links.length, 0, "연결도 안 들어감");
});

test("마지막 학과에서 빼면 기타 과목(순서 없음)이 되고, 선생님은 쓸 수 없다", async () => {
  const { db, d1, a } = await setup();
  await as(db, "authenticated", TEACHER);
  await assert.rejects(save(db, [], [], [{ subject_id: a, department_id: d1 }]), /권한/);
  await as(db, "authenticated", HEAD);
  await save(db, [], [], [{ subject_id: a, department_id: d1 }]);
  await as(db, null);
  const { rows: [x] } = await db.query(`select sort_order from subjects where id = $1`, [a]);
  assert.equal(x.sort_order, null);
});
