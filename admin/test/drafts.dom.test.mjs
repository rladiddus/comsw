// 임시 저장(drafts.mjs): [임시 저장] → 화면을 벗어났다 다시 그려지면 [임시저장(내용있음)] → 누르면 입력란을 다시 채운다.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { drafts } from "../js/drafts.mjs";

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test("임시 저장 → 다시 그려진 화면에서 (내용있음) → 불러오면 고르기로 새로 생긴 칸까지 채움, 같아지면 다시 [임시 저장]", async () => {
  const { window } = new JSDOM("<!doctype html><body><main id=content></main></body>", { url: "http://localhost/admin-v3/#/aggregate", pretendToBeVisual: true });
  const doc = window.document;
  window.confirm = () => true;
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  // 학과를 고르면 그 학과 칸이 새로 그려지는 화면(저장된 값으로 처음 그림)
  const changes = [];
  function page() {
    const c = doc.getElementById("content");
    c.innerHTML = `<select aria-label="학과"><option value="a">A</option><option value="b">B</option></select><div class="body"></div>`;
    const sel = c.querySelector("select");
    const body = () => {
      c.querySelector(".body").innerHTML = `<textarea aria-label="요약 ${sel.value}"></textarea><input type="checkbox" aria-label="사용"><input type="file">`;
      c.querySelector("textarea").addEventListener("input", (e) => changes.push(e.target.value));
    };
    sel.addEventListener("change", body);
    body();
  }
  page();
  const d = drafts({ uid: "u1", doc, storage });
  const save = d.bar.querySelector(".publish-btn");
  assert.equal(save.textContent, "임시 저장");
  assert.equal(d.bar.hidden, false, "입력칸이 있는 화면");
  const c = doc.getElementById("content");
  c.querySelector("select").value = "b";
  c.querySelector("select").dispatchEvent(new window.Event("change"));
  c.querySelector("textarea").value = "B 학과 요약";
  c.querySelector("input[type=checkbox]").checked = true;
  save.click();
  assert.ok(store.has("comsw_draft:u1:#/aggregate"), "사용자·화면별");
  assert.match(d.bar.textContent, /임시 저장했습니다/);

  page(); // 다른 메뉴에 갔다 와서 저장된 값(A)으로 다시 그려짐
  await wait(300);
  assert.equal(save.textContent, "임시저장(내용있음)");
  save.click();
  await wait(200);
  assert.equal(c.querySelector("select").value, "b");
  assert.equal(c.querySelector("textarea").getAttribute("aria-label"), "요약 b", "학과를 바꿔 새로 생긴 칸");
  assert.equal(c.querySelector("textarea").value, "B 학과 요약");
  assert.equal(c.querySelector("input[type=checkbox]").checked, true);
  assert.deepEqual(changes, ["B 학과 요약"], "화면이 알아차리게 입력 이벤트");
  await wait(300);
  assert.equal(save.textContent, "임시 저장", "입력란과 같아지면 다시 저장 버튼");

  // 입력칸 없는 화면에서는 숨김, 다른 사용자는 따로
  c.innerHTML = "<p>글만</p>";
  await wait(300);
  assert.equal(d.bar.hidden, true);
  page();
  drafts({ uid: "u2", doc, storage });
  await wait(300);
  assert.equal(save.textContent, "임시 저장", "u2에게는 u1의 임시 저장이 안 보임");
});
