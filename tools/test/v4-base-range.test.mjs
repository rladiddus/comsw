// 20261120040000: 기준 과목 이름 — 끝 숫자뿐 아니라 범위(1~2)도 뗀다(화면 baseName과 같게).
import test from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "./pg.mjs";

test("기준 과목 이름: 끝 숫자·범위를 뗀다", async () => {
  const db = await freshDb();
  const base = async (n) => (await db.query(`select comsw_private.v4_base($1) b`, [n])).rows[0].b;
  assert.equal(await base("디지털 드로잉 1~2"), "디지털 드로잉");
  assert.equal(await base("캐드1~2"), "캐드");
  assert.equal(await base("캐드2"), "캐드");
  assert.equal(await base("3D맥스"), "3D맥스");
  assert.equal(await base("123"), "123");
});
