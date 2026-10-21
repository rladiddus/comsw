import test from "node:test";
import assert from "node:assert/strict";
import { driveThumbnail } from "../js/drive.mjs";

test("드라이브 주소는 썸네일 주소로", () => {
  assert.equal(driveThumbnail("https://drive.google.com/file/d/ABC_1-x/view?usp=drive_link"), "https://drive.google.com/thumbnail?id=ABC_1-x&sz=w1000");
  assert.equal(driveThumbnail("https://drive.google.com/open?id=XYZ"), "https://drive.google.com/thumbnail?id=XYZ&sz=w1000");
  assert.equal(driveThumbnail("https://example.com/a.jpg"), "https://example.com/a.jpg");
  assert.equal(driveThumbnail(""), "");
  assert.equal(driveThumbnail(null), "");
});
