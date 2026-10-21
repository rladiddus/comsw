import test from "node:test";
import assert from "node:assert/strict";
import { seeded, as } from "./pg.mjs";

// fixture 특강 날짜(2026-08-18)는 언젠가 지나므로 신청 테스트에서는 미래로 옮긴다.
async function open() {
  const db = await seeded();
  await db.exec(`update seminars set datetime_text = '2999년 1월 1일 14:00-16:00'`);
  await as(db, "anon");
  return db;
}
const apply = async (db, title, name, phone) =>
  (await db.query(`select comsw_apply_seminar($1, $2, $3) as r`, [title, name, phone])).rows[0].r;

test("정상 신청은 저장하고 신청 수를 돌려준다", async () => {
  const db = await open();
  assert.deepEqual(await apply(db, "AI 특강", " 이영희 ", "010-5555-6666"), { ok: true, applied: 3 });
});

test("이름·연락처 검사", async () => {
  const db = await open();
  assert.equal((await apply(db, "AI 특강", "", "010-1234-5678")).error, "이름을 입력해주세요.");
  assert.equal((await apply(db, "AI 특강", "Tom", "010-1234-5678")).error, "한글만 입력해주세요");
  assert.equal((await apply(db, "AI 특강", "가".repeat(21), "010-1234-5678")).error, "이름이 너무 깁니다.");
  assert.equal((await apply(db, "AI 특강", "이영희", "")).error, "연락처를 입력해주세요.");
  assert.equal((await apply(db, "AI 특강", "이영희", "0101234")).error, "연락처 형식은 000-0000-0000입니다.");
});

test("같은 사람 두 번 → 이미 신청되었습니다, 1건만", async () => {
  const db = await open();
  await apply(db, "AI 특강", "이영희", "010-5555-6666");
  assert.deepEqual(await apply(db, "AI 특강", "이영희", "010-5555-6666"),
    { ok: false, duplicate: true, error: "이미 신청되었습니다" });
  await as(db, null);
  assert.equal((await db.query(`select count(*)::int n from seminar_applications`)).rows[0].n, 3);
});

test("지난 특강·없는 특강", async () => {
  const db = await open();
  assert.equal((await apply(db, "없는 특강", "이영희", "010-5555-6666")).error, "특강을 찾을 수 없습니다");
  await as(db, null);
  await db.exec(`update seminars set datetime_text = '2020년 1월 1일'`);
  await as(db, "anon");
  assert.equal((await apply(db, "AI 특강", "이영희", "010-5555-6666")).error, "특강 신청일이 지났습니다.");
});

test("날짜를 못 읽으면 지난 것으로 보지 않는다", async () => {
  const db = await open();
  await as(db, null);
  await db.exec(`update seminars set datetime_text = '추후 공지'`);
  await as(db, "anon");
  assert.equal((await apply(db, "AI 특강", "이영희", "010-5555-6666")).ok, true);
});

test("날짜 읽기", async () => {
  const db = await open();
  const year = new Date().getFullYear();
  const cases = [
    ["2026년 8월 18일 14:00-16:00", "2026-08-18"],
    ["2026.8.5", "2026-08-05"],
    ["2026-08-19 (수)", "2026-08-19"],
    ["2026/12/01", "2026-12-01"],
    ["8월 18일 오후 2시", `${year}-08-18`],
    ["추후 공지", null],
    ["", null],
  ];
  for (const [text, want] of cases) {
    const { d } = (await db.query(`select comsw_seminar_date($1)::text d`, [text])).rows[0];
    assert.equal(d, want, text);
  }
});

test("신청 수 함수는 이름·연락처 없이 수만", async () => {
  const db = await open();
  const { rows, fields } = await db.query(`select * from comsw_seminar_counts()`);
  assert.deepEqual(fields.map(f => f.name), ["title", "applied"]);
  assert.deepEqual(rows, [{ title: "AI 특강", applied: 2 }]);
});

test("익명은 신청 명단을 직접 읽지 못한다", async () => {
  const db = await open();
  await apply(db, "AI 특강", "이영희", "010-5555-6666");
  // 테스트 DB는 권한 자체가 없어 거부, 실제 Supabase는 RLS로 빈 결과 — 둘 다 못 읽는 것.
  const rows = await db.query(`select * from seminar_applications`).then(r => r.rows, () => []);
  assert.equal(rows.length, 0);
});
