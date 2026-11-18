// 학과명 바꾸기(20261118030000): 같은 이름의 학과 탭도 바뀌고, 옛 이름은 former_names에 남는다(쌤톡 학과 연결).
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./pg.mjs";

test("학과명을 바꾸면 그 학과의 같은 이름 학과 탭도 바뀌고 옛 이름을 기억한다", async () => {
  const db = await freshDb();
  const { rows: [d] } = await db.query(`insert into departments (name) values ('게임학과') returning id`);
  await db.query(`insert into curriculum_sets (name, department_id) values ('게임학과', $1), ('게임 특강', $1)`, [d.id]);
  await db.query(`update departments set name = '게임콘텐츠학과' where id = $1`, [d.id]);
  await db.query(`update departments set name = '게임개발학과' where id = $1`, [d.id]);
  const { rows: [dep] } = await db.query(`select name, former_names from departments where id = $1`, [d.id]);
  assert.deepEqual(dep, { name: "게임개발학과", former_names: ["게임학과", "게임콘텐츠학과"] });
  const { rows: sets } = await db.query(`select name from curriculum_sets order by name`);
  assert.deepEqual(sets.map((r) => r.name), ["게임 특강", "게임개발학과"], "다른 이름 탭은 그대로");
  // 되돌리면 옛 이름 목록에서 지금 이름은 빠진다
  await db.query(`update departments set name = '게임학과' where id = $1`, [d.id]);
  const { rows: [back] } = await db.query(`select former_names from departments where id = $1`, [d.id]);
  assert.deepEqual(back.former_names, ["게임콘텐츠학과", "게임개발학과"]);
  // 다른 칸만 고치면 그대로
  await db.query(`update departments set name_en = 'GAME' where id = $1`, [d.id]);
  assert.deepEqual((await db.query(`select former_names from departments where id = $1`, [d.id])).rows[0].former_names, ["게임콘텐츠학과", "게임개발학과"]);
});
