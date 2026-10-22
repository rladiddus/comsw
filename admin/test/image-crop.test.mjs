import test from "node:test";
import assert from "node:assert/strict";
import { adjustCrop, initialCrop, panCrop } from "../js/image-crop.mjs";

test("가로·세로 이미지를 원본 중앙의 정사각형으로 시작", () => {
  assert.deepEqual(initialCrop(1800, 1200), {
    width: 1800,
    height: 1200,
    x: 300,
    y: 0,
    side: 1200,
  });
  assert.deepEqual(initialCrop(1200, 2000), {
    width: 1200,
    height: 2000,
    x: 0,
    y: 400,
    side: 1200,
  });
});
test("최소 1000px 크롭 영역을 유지하고 위치가 원본을 벗어나지 않음", () => {
  assert.throws(() => initialCrop(999, 1800), /1000/);
  const crop = initialCrop(2200, 1400);
  const changed = adjustCrop(crop, { side: 500, x: 9999, y: -200 });
  assert.equal(changed.side, 1000);
  assert.equal(changed.x, 1200);
  assert.equal(changed.y, 0);
  const moved = panCrop(crop, -10000, 10000, 500);
  assert.equal(moved.x, 800);
  assert.equal(moved.y, 0);
});
