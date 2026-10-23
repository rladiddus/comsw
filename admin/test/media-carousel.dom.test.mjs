import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { fakeSupabase } from "./fake-supabase.mjs";
import { mountMediaCarousel } from "../js/media-carousel.mjs";
import { mediaKind } from "../js/media-preview.mjs";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
globalThis.confirm = () => true;
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0)); };
const button = (c, text) => [...c.querySelectorAll("button")].find((b) => b.textContent === text);

test("미디어 종류는 공개 사이트와 같은 규칙", () => {
  assert.equal(mediaKind("https://youtu.be/abcdefg"), "youtube");
  assert.equal(mediaKind("https://www.pexels.com/ko-kr/download/video/37275421/"), "video");
  assert.equal(mediaKind("https://x.com/a.MP4?x=1"), "video");
  assert.equal(mediaKind("https://drive.google.com/file/d/ID/view"), "drive");
  assert.equal(mediaKind("https://firebasestorage.googleapis.com/v0/b/x/o/a.webp?alt=media"), "image");
  assert.equal(mediaKind(""), "empty");
});

test("왼쪽 미리보기에 번호, 좌우 버튼으로 하나씩 보고, 고친 칸은 바로 저장", async () => {
  const tables = { main_media: [
    { id: "a", url: "https://x.com/a.mp4", caption: "첫 문구", is_active: true, sort_order: 0 },
    { id: "b", url: "https://x.com/b.webp", caption: "", is_active: false, sort_order: 1 },
  ] };
  const c = document.createElement("div");
  await mountMediaCarousel(c, { supabase: fakeSupabase(tables) });
  const badge = () => c.querySelector(".media-badge").textContent;
  assert.equal(badge(), "1번 / 2");
  assert.ok(c.querySelector(".media-stage video"));
  assert.equal(c.querySelector(".media-caption textarea").value, "첫 문구");
  assert.ok(c.querySelector(".media-nav.prev").disabled);
  c.querySelector(".media-nav.next").click();
  assert.equal(badge(), "2번 / 2 · 사용 안 함");
  assert.ok(c.querySelector(".media-stage img"));
  const url = c.querySelector(".media-url input");
  url.value = "https://x.com/c.png";
  url.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.equal(tables.main_media[1].url, "https://x.com/c.png");
  const active = c.querySelector(".media-actions input[type=checkbox]");
  active.checked = true;
  active.dispatchEvent(new dom.window.Event("change"));
  await flush();
  assert.equal(tables.main_media[1].is_active, true);
  assert.equal(badge(), "2번 / 2");
});

test("하나면 좌우 버튼이 없고, + 추가는 사용 안 함 상태의 새 미디어를 만든다", async () => {
  const tables = { main_media: [{ id: "a", url: "https://x.com/a.png", caption: "", is_active: true, sort_order: 0 }] };
  const sb = fakeSupabase(tables);
  const c = document.createElement("div");
  await mountMediaCarousel(c, { supabase: sb });
  assert.equal(c.querySelector(".media-nav"), null, "하나면 좌우 버튼 없음");
  button(c, "+ 추가").click();
  await flush();
  assert.ok(sb.calls.some(([op, t, row]) => op === "insert" && t === "main_media" && row.is_active === false));
});

test("오른쪽 위는 주소|문구, 아래는 사용·수정·추가·삭제, 이미지 직접 올리기는 '수정'을 눌러야 나온다", async () => {
  const tables = { main_media: [{ id: "a", url: "https://x.com/a.png", caption: "문구", is_active: true, sort_order: 0 }] };
  const c = document.createElement("div");
  await mountMediaCarousel(c, { supabase: fakeSupabase(tables) });
  const side = c.querySelector(".media-card > .media-side");
  assert.ok(side.querySelector(".media-top > .media-url input") && side.querySelector(".media-top > .media-caption textarea"));
  const actions = [...side.querySelectorAll(".media-actions > *")].map((x) => x.textContent);
  assert.deepEqual(actions, ["사용", "수정", "+ 추가", "삭제"]);
  const zone = c.querySelector(".upload-zone").parentElement;
  assert.equal(zone.hidden, true);
  button(c, "수정").click();
  assert.equal(zone.hidden, false);
  assert.ok(button(c, "수정 닫기"));
});
