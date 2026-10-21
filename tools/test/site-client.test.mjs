import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const src = f => readFileSync(new URL(`../../assets/js/${f}`, import.meta.url), "utf8");

// 공개 사이트 스크립트(클래식)를 가짜 fetch가 있는 창에서 실행한다.
function site({ page = "index.html", reply = () => [], scripts = ["supabase-client.js"] } = {}) {
  const { window } = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", url: `https://x.github.io/comsw/${page}` });
  const calls = [];
  window.COMSW_SUPABASE_CONFIG = { url: "https://db.example", anonKey: "anon", sources: { main: "main" }, sheets: { main: "메인 페이지" } };
  window.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url, method: opts.method, body });
    return { ok: true, json: async () => reply(url, body) };
  };
  for (const s of scripts) window.eval(src(s));
  return { window, calls };
}
const row = (n, values) => ({ source_id: "main", sheet_name: "x", row_number: n, data: { values } });
const tick = () => new Promise(r => setTimeout(r, 20));

test("fetchSheetRows는 comsw_site_rows RPC를 부른다", async () => {
  const { window, calls } = site({ reply: () => [row(2, ["a"])] });
  const rows = await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(rows.length, 1);
  assert.equal(calls[0].url, "https://db.example/rest/v1/rpc/comsw_site_rows");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { p_source: "main", p_sheet: "로드맵" });
  await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(calls.length, 1, "같은 시트는 캐시");
});

test("전체수업 시트는 이미지 후보 중 하나를 H에 넣는다", async () => {
  const v = Array(25).fill("");
  v[7] = "img1"; v[24] = "cand-a\ncand-b";
  const plain = Array(25).fill(""); plain[7] = "img2";
  const { window } = site({ reply: () => [row(2, v), row(3, plain)] });
  window.ComswSupabase._random = () => 0.99;
  const rows = await window.ComswSupabase.fetchSheetRows("컴수원_전체수업");
  assert.equal(rows[0].data.values[7], "cand-b");
  assert.equal(rows[1].data.values[7], "img2", "후보가 없으면 그대로");
});

test("특강 신청·신청 수 RPC", async () => {
  const { window, calls } = site({
    reply: url => url.endsWith("comsw_apply_seminar") ? { ok: true, applied: 3 } : [{ title: "AI 특강", applied: 2 }],
  });
  assert.deepEqual({ ...(await window.ComswSupabase.applySeminar("AI 특강", "이영희", "010-5555-6666")) }, { ok: true, applied: 3 });
  assert.deepEqual(calls[0].body, { p_title: "AI 특강", p_name: "이영희", p_phone: "010-5555-6666" });
  assert.deepEqual({ ...(await window.ComswSupabase.fetchSeminarCounts()) }, { "AI 특강": 2 });
  assert.equal(calls[1].url, "https://db.example/rest/v1/rpc/comsw_seminar_counts");
});

const MENU = [row(2, ["", "", "", "", "전체 수업", "true"]), row(3, ["", "", "", "", "특강/세미나", "false"])];
for (const [script, off, on] of [
  ["footer-menu.js", "seminar.html", "roadmap.html"],
  ["footer-menu-tablet.js", "seminar_tablet.html", "roadmap_tablet.html"],
]) {
  test(`${script}: 꺼진 페이지는 준비 중, 켜진 페이지·메뉴 밖 페이지는 그대로`, async () => {
    const scripts = ["supabase-client.js", script];
    const offSite = site({ page: off, reply: () => MENU, scripts });
    await tick();
    const overlay = offSite.window.document.getElementById("comsw-page-off");
    assert.ok(overlay, "덮개");
    assert.match(overlay.textContent, /준비 중입니다/);
    assert.equal(overlay.querySelector("a").getAttribute("href"), "./index.html");
    for (const page of [on, "index.html"]) {
      const s = site({ page, reply: () => MENU, scripts });
      await tick();
      assert.equal(s.window.document.getElementById("comsw-page-off"), null, page);
    }
  });
}
