import test from "node:test";
import assert from "node:assert/strict";
import { adjustCrop, initialCrop, panCrop, cropFragment, parseCrop, stripCrop, applyCrop, THUMB_RATIO } from "../js/image-crop.mjs";

test("썸네일 영역은 사이트 카드와 같은 세로 직사각형(269:391), 원본 중앙에서 가장 크게 시작", () => {
  const wide = initialCrop(2000, 1200);
  assert.equal(wide.h, 1200);
  assert.ok(Math.abs(wide.w / wide.h - THUMB_RATIO) < 1e-9);
  assert.equal(wide.x, (2000 - wide.w) / 2);
  const tall = initialCrop(1200, 3000);
  assert.equal(tall.w, 1200);
  assert.equal(tall.y, (3000 - tall.h) / 2);
  assert.doesNotThrow(() => initialCrop(120, 80), "픽셀 크기 제한 없음");
});

test("영역은 원본을 벗어나지 않고, 끌면 반대로 움직인다", () => {
  const c = initialCrop(2200, 1400);
  const changed = adjustCrop(c, { w: 100, x: 9999, y: -200 });
  assert.equal(changed.w, 300, "가장 작은 가로 300px");
  assert.equal(changed.x, 2200 - 300);
  assert.equal(changed.y, 0);
  const moved = panCrop(c, -10000, 10000, 340);
  assert.equal(moved.x, 2200 - c.w);
  assert.equal(moved.y, 0);
});

test("영역은 주소 뒤 '#crop=x,y,w,h'(비율)로 남고, 썸네일만 그 영역을 보여 준다", () => {
  const c = { width: 2000, height: 1000, x: 500, y: 0, w: 500, h: 500 / THUMB_RATIO };
  const url = `https://img.example/a.webp?alt=media${cropFragment(c)}`;
  assert.equal(stripCrop(url), "https://img.example/a.webp?alt=media");
  const p = parseCrop(url);
  assert.deepEqual([p.x, p.y, p.w], [0.25, 0, 0.25]);
  assert.equal(parseCrop("https://img.example/old-square.png"), null, "예전 이미지는 영역 없음");
  const img = { style: {}, classList: { add() {} } };
  applyCrop(img, "https://x#crop=0.25,0.1,0.5,0.5");
  assert.deepEqual([img.style.width, img.style.height, img.style.left, img.style.top], ["200%", "200%", "-50%", "-20%"]);
});
