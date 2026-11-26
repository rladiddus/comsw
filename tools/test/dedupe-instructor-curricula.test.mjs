// 강사 커리큘럼 중복 정리(20261126050000): 같은 원문·이미지가 여러 학과 탭에 있으면 강사의 학과 탭만 남김.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, runMigration } from "./pg.mjs";

const FILE = "20261126050000_dedupe_instructor_curricula.sql";

test("완전히 같은 중복(순서·요약만 다름)은 강사의 학과 탭만 남기고 보관 뒤 지움, 내용이 다르거나 남길 탭이 없거나 방학 특강이면 그대로", async () => {
  const db = await freshDb(FILE);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const inter = await one(`insert into departments(name) values ('인테리어학과') returning id`);
  const office = await one(`insert into departments(name) values ('사무 자격증') returning id`);
  const sInter = await one(`insert into curriculum_sets(name, department_id) values ('인테리어학과', $1) returning id`, [inter]);
  const sOffice = await one(`insert into curriculum_sets(name, department_id) values ('사무 자격증', $1) returning id`, [office]);
  const sVac = await one(`insert into curriculum_sets(name, is_vacation) values ('겨울 특강', true) returning id`);
  const on = await one(`insert into instructors(name) values ('온세상') returning id`);
  const other = await one(`insert into instructors(name) values ('다른강사') returning id`);
  await db.query(`insert into instructor_departments(instructor_id, department_id) values ($1, $2)`, [on, inter]);
  const subj = async (n) => one(`insert into subjects(name) values ($1) returning id`, [n]);
  const [r1, r2, cad] = [await subj("라이노 1"), await subj("라이노 2"), await subj("캐드1")];
  const steps = async (who, set, sub, { summary = "요약", order = 0, text = "원문" } = {}) => {
    for (const n of [1, 2]) await db.query(`insert into instructor_curricula(set_id, instructor_id, subject_id, step_label, written, summary, media_url, status, sort_order)
      values ($1, $2, $3, $4, $5, $6, $7, 'approved', $8)`, [set, who, sub, `${n}단계`, `${text}${n}`, `${summary}${n}`, `https://x/${n}.png`, n + order]);
  };
  await steps(on, sInter, r1);
  await steps(on, sOffice, r1, { summary: "다른 요약", order: 10 }); // 순서·요약만 다름 → 지움
  await steps(on, sInter, r2);
  await steps(on, sOffice, r2, { text: "고친 원문" }); // 원문이 다름 → 그대로
  await steps(on, sVac, r1); // 방학 특강 → 그대로
  await steps(other, sInter, cad);
  await steps(other, sOffice, cad); // 다른강사는 학과 설정이 없어 남길 탭이 없음 → 그대로
  await db.query(`insert into site_snapshots(published_by, rows) values ('t', comsw_build_rows())`);
  const snaps = async () => (await db.query(`select count(*)::int n from site_snapshots`)).rows[0].n;
  const before = await snaps();

  await runMigration(db, FILE);

  const left = async (who, set, sub) => (await db.query(`select count(*)::int n from instructor_curricula where instructor_id = $1 and set_id = $2 and subject_id = $3`, [who, set, sub])).rows[0].n;
  assert.equal(await left(on, sOffice, r1), 0, "중복은 지움");
  assert.equal(await left(on, sInter, r1), 2, "강사의 학과 탭은 남김");
  assert.equal((await db.query(`select summary from instructor_curricula where instructor_id = $1 and set_id = $2 and subject_id = $3 order by step_label`, [on, sInter, r1])).rows[0].summary, "요약1", "남기는 쪽 요약 그대로");
  assert.equal(await left(on, sOffice, r2), 2, "원문이 다르면 그대로");
  assert.equal(await left(on, sVac, r1), 2, "방학 특강은 그대로");
  assert.equal(await left(other, sOffice, cad) + await left(other, sInter, cad), 4, "남길 탭이 없으면 그대로");
  const kept = (await db.query(`select row from comsw_private.instructor_curricula_backup`)).rows.map((r) => r.row);
  assert.equal(kept.length, 2, "지운 줄은 보관");
  assert.deepEqual(kept.map((r) => r.summary).sort(), ["다른 요약1", "다른 요약2"]);
  assert.equal(await snaps(), before + 1, "깨끗했으면 바로 공개");

  await runMigration(db, FILE); // 다시 실행해도 문제없음
  assert.equal(await snaps(), before + 1, "지울 것이 없으면 공개 안 함");
});
