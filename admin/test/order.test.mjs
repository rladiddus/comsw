import test from "node:test";
import assert from "node:assert/strict";
import { nextOrder, moveUpdates, freeName } from "../js/order.mjs";

test("새 줄 이름은 아직 없는 가장 작은 번호", () => {
  assert.equal(freeName("새 메뉴", [], "name"), "새 메뉴 1");
  assert.equal(freeName("새 메뉴", [{ name: "새 메뉴 1" }, { name: "새 메뉴 3" }], "name"), "새 메뉴 2");
  assert.equal(freeName("새 특강", [{ title: "새 특강 1" }, { title: "새 특강 2" }], "title"), "새 특강 3");
});

test("다음 순서 번호", () => {
  assert.equal(nextOrder([]), 0);
  assert.equal(nextOrder([{ sort_order: 3 }, { sort_order: null }, { sort_order: 7 }]), 8);
});

test("위로 옮기면 두 줄만 바뀐다", () => {
  const rows = [{ id: "a", sort_order: 0 }, { id: "b", sort_order: 1 }, { id: "c", sort_order: 2 }];
  assert.deepEqual(moveUpdates(rows, 2, -1), [{ id: "b", sort_order: 2 }, { id: "c", sort_order: 1 }]);
});

test("겹치거나 빈 순서 번호는 화면 순서대로 다시 매긴다", () => {
  const rows = [{ id: "a", sort_order: 5 }, { id: "b", sort_order: 5 }, { id: "c", sort_order: null }];
  assert.deepEqual(moveUpdates(rows, 0, 1),
    [{ id: "a", sort_order: 1 }, { id: "b", sort_order: 0 }, { id: "c", sort_order: 2 }]);
});

test("맨 위에서 위로, 맨 아래에서 아래로는 아무것도 안 바뀐다", () => {
  const rows = [{ id: "a", sort_order: 0 }, { id: "b", sort_order: 1 }];
  assert.deepEqual(moveUpdates(rows, 0, -1), []);
  assert.deepEqual(moveUpdates(rows, 1, 1), []);
});
