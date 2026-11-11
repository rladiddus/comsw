// 준비물 분류(20261111010000): 선생님이 물품·교재·AI 도구로 내면, 승인 때 수업별 준비물에 분류대로 들어가고
// 과목 준비물 칸에는 교재·물품만 합쳐진다.
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

const ADMIN = { sub: "a", role: "authenticated", comsw_role: "admin" };
const TEACHER = { sub: "uid-t1", role: "authenticated", comsw_role: "teacher" };

test("교재·물품·AI 도구로 내면 승인 때 수업별 준비물에 분류대로, 과목 준비물 칸은 교재+물품", async () => {
  const db = await seeded();
  await as(db, null);
  const { rows: [i] } = await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1') returning id`);
  const { rows: [s] } = await db.query(`select id from subjects order by name limit 1`);
  const { rows: [set] } = await db.query(`select id from curriculum_sets limit 1`);
  await db.query(`insert into instructor_subjects(instructor_id, subject_id) values ($1, $2)`, [i.id, s.id]);
  await db.query(`update subjects set tools = 'Photoshop', supplies = null where id = $1`, [s.id]);
  await db.query(`delete from course_prep_items where subject_id = $1`, [s.id]);
  await db.query(`insert into course_prep_items(subject_id, category, content) values ($1, 'textbook', '이미 있는 교재')`, [s.id]);

  await as(db, "authenticated", TEACHER);
  const list = [{ subject_id: s.id, tools: "Illustrator", supplies: "노트북, 마우스", textbook: "포토샵 교재\n이미 있는 교재", ai: "ChatGPT, 노트북",
    steps: [{ step_label: "1단계", written: "원문", media_url: "" }] }];
  assert.equal((await db.query(`select comsw_submit_curriculum($1, false, $2::jsonb, null) n`, [set.id, JSON.stringify(list)])).rows[0].n, 1);
  await as(db, null);
  assert.deepEqual((await db.query(`select tools, supplies, textbook, ai from instructor_subject_materials`)).rows,
    [{ tools: "Illustrator", supplies: "노트북, 마우스", textbook: "포토샵 교재\n이미 있는 교재", ai: "ChatGPT, 노트북" }]);

  const { rows: [{ id }] } = await db.query(`select id from instructor_curricula where status = 'pending'`);
  await as(db, "authenticated", ADMIN);
  await db.query(`select comsw_approve_curriculum($1)`, [id]);
  await as(db, null);
  const items = (await db.query(`select category, content from course_prep_items where subject_id = $1 order by sort_order nulls first, content`, [s.id])).rows
    .map((r) => `${r.category}:${r.content}`);
  assert.deepEqual(items, ["textbook:이미 있는 교재", "textbook:포토샵 교재", "supply:노트북", "supply:마우스", "ai:ChatGPT"],
    "이미 있는 것은 건너뛰고, 여러 분류에 있으면 앞 분류(물품) 하나만");
  assert.deepEqual((await db.query(`select tools, supplies from subjects where id = $1`, [s.id])).rows[0],
    { tools: "Photoshop\nIllustrator", supplies: "포토샵 교재, 이미 있는 교재\n노트북, 마우스" }, "준비물 칸 = 교재 + 물품(AI 도구는 안 넣음)");
});

test("분류 칸 없이 내면(예전 화면) 예전처럼 물품만", async () => {
  const db = await seeded();
  await as(db, null);
  const { rows: [i] } = await db.query(`insert into instructors(name, account_uid) values ('t1', 'uid-t1') returning id`);
  const { rows: [s] } = await db.query(`select id from subjects order by name limit 1`);
  const { rows: [set] } = await db.query(`select id from curriculum_sets limit 1`);
  await db.query(`insert into instructor_subjects(instructor_id, subject_id) values ($1, $2)`, [i.id, s.id]);
  await as(db, "authenticated", TEACHER);
  await db.query(`select comsw_submit_curriculum($1, false, $2::jsonb, null)`, [set.id, JSON.stringify([{ subject_id: s.id, tools: "", supplies: "이어폰" }])]);
  await as(db, null);
  assert.deepEqual((await db.query(`select supplies, textbook, ai from instructor_subject_materials`)).rows, [{ supplies: "이어폰", textbook: null, ai: null }]);
});
