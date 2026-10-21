import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../js/csv.mjs";

test("CSV: BOM, 따옴표, 쉼표, 줄바꿈, 빈 값", () => {
  const csv = toCsv(["이름", "연락처"], [["홍\"길동", "010-1234-5678"], ["김, 철수", null], ["줄\n바꿈", "x"]]);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(csv.slice(1), '"이름","연락처"\r\n"홍""길동","010-1234-5678"\r\n"김, 철수",""\r\n"줄\n바꿈","x"');
});
