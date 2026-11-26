// V4 준비물 저장(20261126080000): 가격·구독 비용(extra)·교재 이미지(image_url)도 저장, 잘못된 값은 막음.
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb, as } from "./pg.mjs";

test("준비물 저장: extra·image_url을 그대로 저장, 이미지 주소는 http(s)만, 가격·비용 200자까지", async () => {
  const db = await freshDb();
  await as(db, null);
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.id;
  const c1 = await one(`insert into subjects(name) values ('캐드1') returning id`);
  const c2 = await one(`insert into subjects(name) values ('캐드2') returning id`);
  await db.query(`insert into site_snapshots(published_by, rows) values ('t', comsw_build_rows())`);
  await as(db, "authenticated", { sub: "h", role: "authenticated", comsw_role: "head" });
  const save = (items) => db.query(`select comsw_v4_confirm_prep('캐드', $1)`, [JSON.stringify(items)]);
  await save([{ category: "textbook", content: "멘토 캐드", link_url: "https://book.kr/c", image_url: "https://img/c.png", extra: "33,000원" },
    { category: "ai", content: "ChatGPT", extra: "월 $20(Pro)" }]);
  await as(db, null);
  const rows = (await db.query(`select subject_id, content, image_url, extra from course_prep_items order by subject_id, sort_order`)).rows;
  assert.equal(rows.length, 4, "캐드1·캐드2 모두에");
  assert.deepEqual(rows.filter((r) => r.subject_id === c1).map((r) => [r.content, r.image_url, r.extra]), [["멘토 캐드", "https://img/c.png", "33,000원"], ["ChatGPT", null, "월 $20(Pro)"]]);
  assert.ok(rows.some((r) => r.subject_id === c2));
  await as(db, "authenticated", { sub: "h", role: "authenticated", comsw_role: "head" });
  await assert.rejects(save([{ category: "textbook", content: "x", image_url: "javascript:alert(1)" }]), /확인해주세요/);
  await assert.rejects(save([{ category: "ai", content: "x", extra: "가".repeat(201) }]), /확인해주세요/);
});
