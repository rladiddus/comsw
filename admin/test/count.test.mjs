import test from "node:test";
import assert from "node:assert/strict";
import { countRows } from "../js/count.mjs";

const fake = result => ({ from: () => ({ select: () => ({ eq: () => Promise.resolve(result) }) }) });

test("개수를 센다", async () => {
  assert.equal(await countRows(fake({ count: 3, error: null }), "subject_weeks", "subject_id", "a"), 3);
});

test("세지 못하면 0으로 치지 않고 오류를 던진다", async () => {
  await assert.rejects(countRows(fake({ count: null, error: { message: "x" } }), "t", "c", "v"),
    /함께 지워질 데이터 수를 확인하지 못했습니다/);
});
