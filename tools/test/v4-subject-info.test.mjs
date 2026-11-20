// 20261120060000: 학과 구성 표의 과목 정보 저장(공개 학과 커리큘럼 칸) + 확정 때 이미지 바꾸기.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

const HEAD = { sub: "uid-h", role: "authenticated", comsw_role: "head" };

test("과목 정보: 기간·과정내용·프로그램·학습수준을 고쳐 바로 공개, 잘못된 학습수준은 막음", async () => {
  const db = await freshDb();
  await as(db, null);
  const s = (await db.query(`insert into subjects(name, sort_order, tools, supplies) values ('AI포토샵', 0, '옛 프로그램', '옛 준비물') returning id`)).rows[0].id;
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const save = (items) => db.query(`select comsw_v4_save_subject_info($1::jsonb)`, [JSON.stringify(items)]);
  await assert.rejects(save([{ id: s, level: "★★★★★★" }]), /학습수준/);
  await save([{ id: s, duration: "1개월", dept_curriculum: "01 하나\n02 둘", program: "Photoshop\nChatGPT", level: "★★★☆☆" }]);
  await as(db, null);
  const r = (await db.query(`select duration, dept_curriculum, program, level, supplies from subjects where id = $1`, [s])).rows[0];
  assert.deepEqual([r.duration, r.dept_curriculum, r.program, r.level, r.supplies], ["1개월", "01 하나\n02 둘", "Photoshop\nChatGPT", "★★★☆☆", null]);
  const snap = (await db.query(`select rows from site_snapshots order by id desc limit 1`)).rows[0].rows;
  const row = snap.find((x) => x.sheet_name === "컴수원_전체수업" && x.data.values[2] === "AI포토샵").data.values;
  assert.deepEqual([row[6], row[9], row[10], row[11]], ["1개월", "01 하나\n02 둘", "Photoshop\nChatGPT", "★★★☆☆"], "바로 공개");
  await as(db, "authenticated", { sub: "t", role: "authenticated", comsw_role: "teacher" });
  await assert.rejects(save([{ id: s, duration: "2개월" }]), /권한/);
});

test("이번 제출 확정: 학과장이 바꾼 단계 이미지도 함께(비우면 강사 이미지), 잘못된 주소는 막음", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const d = await one(`insert into departments(name) values ('학과') returning id`);
  const s = await one(`insert into subjects(name) values ('캐드1') returning id`);
  const set = await one(`insert into curriculum_sets(name, department_id) values ('학과', $1) returning id`, [d]);
  const i = await one(`insert into instructors(name) values ('김강사') returning id`);
  for (let n = 1; n <= 4; n++) {
    await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, media_url, status, sort_order) values ($1,$2,$3,$4,'원문',$5,'pending',$6)`,
      [set, i, s, `${n}단계`, n === 1 ? "https://img/old.png" : null, n]);
  }
  await as(db, "authenticated", HEAD);
  await db.query(`select comsw_publish()`);
  const rows = (await db.query(`select id, updated_at, step_label from instructor_curricula order by step_label`)).rows;
  const steps = (url2) => JSON.stringify(rows.map((r) => ({ id: r.id, updated_at: r.updated_at.toISOString(), summary: "", media_url: r.step_label === "2단계" ? url2 : "" })));
  await assert.rejects(db.query(`select comsw_v4_confirm_curriculum($1,$2,$3,$4::jsonb)`, [i, set, s, steps("javascript:x")]), /이미지 주소/);
  await db.query(`select comsw_v4_confirm_curriculum($1,$2,$3,$4::jsonb)`, [i, set, s, steps("https://img/new.png#crop=0,0,1,1")]);
  const got = (await db.query(`select step_label, media_url, status from instructor_curricula order by step_label`)).rows;
  assert.deepEqual(got.map((r) => [r.media_url, r.status]), [["https://img/old.png", "approved"], ["https://img/new.png#crop=0,0,1,1", "approved"], [null, "approved"], [null, "approved"]]);
});
