// 로드맵 과목 블록 팝업(assets/js/subject-popup.js): 블록 이름 → 과목 펼치기, 학과의 단계 모으기, 로드맵 PC·태블릿에 연결
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const ROOT = new URL("../../", import.meta.url);
const { window } = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
window.eval(readFileSync(new URL("assets/js/subject-popup.js", ROOT), "utf8"));
const { resolve, subjectsOf } = window.ComswSubjectPopup;

const row = (dept, name, step, text, img = "") => Object.assign(Array(26).fill(""), { 1: dept, 2: name, 3: step, 5: text, 7: img });
const rows = [
  row("아트웍, CG", "디지털 드로잉 1~2", "1단계", "선 연습"), row("아트웍, CG", "디지털 드로잉 3~4", "1단계", "골격"),
  row("아트웍", "디지털 드로잉 7~12", "1단계", "컨셉"), row("아트웍", "AI웹툰1", "1단계", "기획"), row("아트웍", "AI웹툰2", "1단계", "콘티"),
  row("아트웍", "AI웹툰10", "1단계", "범위 밖"), row("시각편집", "AI포토샵", "1단계", "합성"), row("아트웍", "AI포토샵", "1단계", "합성"),
  row("아트웍", "AI일러스트", "1단계", "벡터"), row("아트웍", "단계 없음", "", "내용만"),
];

test("학과의 과목별 단계: B열에 학과가 든 줄만, 단계 없는 줄은 뺌", () => {
  const list = subjectsOf("아트웍학과", rows);
  assert.deepEqual([...list.map((s) => s.name)], ["디지털 드로잉 1~2", "디지털 드로잉 3~4", "디지털 드로잉 7~12", "AI웹툰1", "AI웹툰2", "AI웹툰10", "AI포토샵", "AI일러스트"]);
  assert.deepEqual([...list.find((s) => s.name === "AI포토샵").weeks.map((w) => w.content)], ["합성"], "다른 학과 줄은 안 섞임");
});

test("블록 이름 → 과목: 정확히 같은 이름, 합친 범위(1~4·1~6)는 그 안의 과목, 여러 과목 묶음", () => {
  const list = subjectsOf("아트웍학과", rows);
  const names = (label) => [...resolve(label, list).map((s) => s.name)]; // 다른 창(jsdom)의 배열이라 펼쳐서 비교
  assert.deepEqual(names("디지털 드로잉 1~4"), ["디지털 드로잉 1~2", "디지털 드로잉 3~4"]);
  assert.deepEqual(names("디지털 드로잉 7~12"), ["디지털 드로잉 7~12"], "정확히 같은 이름이 먼저");
  assert.deepEqual(names("AI웹툰 1~6"), ["AI웹툰1", "AI웹툰2"], "범위 밖(10)은 뺌");
  assert.deepEqual(names("AI포토샵\nAI일러스트"), ["AI포토샵", "AI일러스트"]);
  assert.deepEqual(names("AI포토샵, AI일러스트"), ["AI포토샵", "AI일러스트"]);
  assert.deepEqual(names("없는 과목"), []);
});

test("팝업: 과목마다 슬라이드(4단계 넘으면 3개씩), 이미지를 누르면 크게 보기, Esc로 닫기", () => {
  const many = [1, 2, 3, 4, 5].map((n) => row("아트웍", "AI웹툰1", `${n}단계`, `내용${n}`, `https://img/${n}.png`));
  window.ComswSubjectPopup.open({ deptName: "아트웍학과", engName: "ART WORK", label: "AI웹툰 1~6", rows: [...many, row("아트웍", "AI웹툰2", "1단계", "콘티")] });
  const doc = window.document;
  assert.equal(doc.querySelectorAll(".sp-slide").length, 3, "AI웹툰1 5단계 → 2장, AI웹툰2 → 1장");
  assert.deepEqual([...doc.querySelectorAll(".sp-badge")].map((b) => b.textContent), ["1 / 2", "2 / 2"]);
  doc.querySelectorAll(".sp-img")[4].click();
  assert.ok(doc.getElementById("sp-lightbox").classList.contains("visible"));
  assert.equal(doc.querySelector(".sp-lb-week").textContent, "5단계");
  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!doc.getElementById("sp-lightbox").classList.contains("visible"));
  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!doc.getElementById("sp-popup").classList.contains("visible"));
});

for (const page of ["roadmap.html", "roadmap_tablet.html"]) {
  test(`${page}: 과목 블록을 누르면 과목 팝업`, () => {
    const html = readFileSync(new URL(page, ROOT), "utf8");
    assert.match(html, /<script src="\.\/assets\/js\/subject-popup\.js\?v=\d+"><\/script>/);
    assert.match(html, /box\.addEventListener\('click', function\(\) \{ openSubjectCurriculum\(dept\.deptName, dept\.engName \|\| '', subj\.name\); \}\);/);
  });
}
