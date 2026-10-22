import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const src = f => readFileSync(new URL(`../../assets/js/${f}`, import.meta.url), "utf8");

// 공개 사이트 스크립트(클래식)를 가짜 fetch가 있는 창에서 실행한다.
// '적용' 번호 확인(comsw_site_version)은 calls에 넣지 않고 versionCalls로 센다.
function site({ page = "index.html", reply = () => [], scripts = ["supabase-client.js"], token, session, version = 7 } = {}) {
  const { window } = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", url: `https://x.github.io/comsw/${page}` });
  if (token) window.localStorage.setItem("comsw_preview_token", token);
  if (session) window.sessionStorage.setItem("comsw_preview", "1");
  const calls = [];
  const state = { version, versionCalls: 0 };
  window.COMSW_SUPABASE_CONFIG = { url: "https://db.example", anonKey: "anon", sources: { main: "main" }, sheets: { main: "메인 페이지" } };
  window.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (url.endsWith("comsw_site_version")) {
      state.versionCalls++;
      if (state.version instanceof Error) return { ok: false, status: 404, text: async () => "없음" };
      return { ok: true, json: async () => state.version };
    }
    calls.push({ url, method: opts.method, body, auth: opts.headers?.Authorization });
    const out = reply(url, body);
    if (out instanceof Error) return { ok: false, status: 401, text: async () => out.message };
    return { ok: true, json: async () => out };
  };
  for (const s of scripts) window.eval(src(s));
  return { window, calls, state };
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
    reply: url => url.endsWith("comsw_apply_seminar") ? { ok: true, applied: 3 } : [{ id: "sem-1", applied: 2 }],
  });
  assert.deepEqual({ ...(await window.ComswSupabase.applySeminar("sem-1", "이영희", "010-5555-6666")) }, { ok: true, applied: 3 });
  assert.deepEqual(calls[0].body, { p_id: "sem-1", p_name: "이영희", p_phone: "010-5555-6666" });
  assert.deepEqual({ ...(await window.ComswSupabase.fetchSeminarCounts()) }, { "sem-1": 2 });
  assert.equal(calls[1].url, "https://db.example/rest/v1/rpc/comsw_seminar_counts");
});

const MENU = [row(2, ["", "", "", "", "전체 수업", "true"]), row(3, ["", "", "", "", "특강/세미나", "false"])];
test("빈 결과(아직 '적용' 전)는 캐시하지 않고 경고한다", async () => {
  const { window, calls } = site({ reply: () => [] });
  const warns = [];
  window.console.warn = (...a) => warns.push(a.join(" "));
  await window.ComswSupabase.fetchSheetRows("로드맵");
  await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(calls.length, 2);
  assert.match(warns[0], /로드맵/);
});

for (const [script, off, on, home] of [
  ["footer-menu.js", "seminar.html", "roadmap.html", "./index.html"],
  ["footer-menu-tablet.js", "seminar_tablet.html", "roadmap_tablet.html", "./index_tablet.html"],
]) {
  test(`${script}: 꺼진 페이지는 준비 중, 켜진 페이지·메뉴 밖 페이지는 그대로`, async () => {
    const scripts = ["supabase-client.js", script];
    const offSite = site({ page: off, reply: () => MENU, scripts });
    await tick();
    const overlay = offSite.window.document.getElementById("comsw-page-off");
    assert.ok(overlay, "덮개");
    assert.match(overlay.textContent, /준비 중입니다/);
    assert.equal(overlay.querySelector("a").getAttribute("href"), home);
    for (const page of [on, "index.html"]) {
      const s = site({ page, reply: () => MENU, scripts });
      await tick();
      assert.equal(s.window.document.getElementById("comsw-page-off"), null, page);
    }
  });
}

test("미리보기: ?preview=1 + 관리 화면이 남긴 토큰이면 적용 전 내용을 토큰으로 읽는다", async () => {
  const { window, calls } = site({ page: "roadmap.html?preview=1", token: "tok", reply: () => [row(2, ["a"])] });
  await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(calls[0].url, "https://db.example/rest/v1/rpc/comsw_preview_rows");
  assert.equal(calls[0].auth, "Bearer tok");
  assert.equal(window.ComswSupabase.isPreview, true);
  assert.equal(window.sessionStorage.getItem("comsw_preview"), "1", "같은 탭에서 다른 페이지로 가도 유지");
});

test("미리보기는 같은 탭에서 이어지고, 토큰이 없으면 일반 화면", async () => {
  const kept = site({ page: "item.html", token: "tok", session: true, reply: () => [row(2, ["a"])] });
  await kept.window.ComswSupabase.fetchSheetRows("로드맵");
  assert.match(kept.calls[0].url, /comsw_preview_rows$/);
  const plain = site({ page: "item.html?preview=1", reply: () => [row(2, ["a"])] });
  await plain.window.ComswSupabase.fetchSheetRows("로드맵");
  assert.match(plain.calls[0].url, /comsw_site_rows$/);
  assert.equal(plain.window.ComswSupabase.isPreview, false);
});

test("미리보기 토큰이 만료되면 적용된 내용으로 보여 주고 표시를 바꾼다", async () => {
  const { window, calls } = site({ page: "item.html?preview=1", token: "old",
    reply: url => url.endsWith("comsw_preview_rows") ? new Error("JWT expired") : [row(2, ["live"])] });
  const rows = await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(rows[0].data.values[0], "live");
  assert.match(calls[1].url, /comsw_site_rows$/);
  await tick();
  assert.match(window.document.getElementById("comsw-preview-badge").textContent, /다시 열어/);
});

test("미리보기 표시가 있고, 끝내기를 누르면 일반 화면으로", async () => {
  const { window } = site({ page: "item.html?preview=1", token: "tok" });
  await tick();
  const badge = window.document.getElementById("comsw-preview-badge");
  assert.match(badge.textContent, /미리보기/);
  badge.querySelector("button").click();
  assert.equal(window.sessionStorage.getItem("comsw_preview"), null);
});

test("미리보기에서는 특강 신청이 저장되지 않는다", async () => {
  const { window, calls } = site({ page: "seminar.html?preview=1", token: "tok" });
  const res = await window.ComswSupabase.applySeminar("sem-1", "이영희", "010-5555-6666");
  assert.equal(res.ok, false);
  assert.match(res.error, /미리보기/);
  assert.equal(calls.filter(c => c.url.endsWith("comsw_apply_seminar")).length, 0);
});

test("미리보기에서는 꺼진 페이지도 열린다", async () => {
  const { window } = site({ page: "seminar.html?preview=1", token: "tok", reply: () => MENU, scripts: ["supabase-client.js", "footer-menu.js"] });
  await tick();
  assert.equal(window.document.getElementById("comsw-page-off"), null);
});

test("같은 '적용' 번호면 새로 고침해도 저장된 내용을 쓰고, 번호가 바뀌면 다시 받는다", async () => {
  const { window, calls, state } = site({ reply: () => [row(2, ["a"])] });
  const reload = () => window.eval(src("supabase-client.js"));
  await window.ComswSupabase.fetchSheetRows("로드맵");
  await window.ComswSupabase.fetchSheetRows("메인 페이지");
  assert.equal(state.versionCalls, 1, "번호 확인은 페이지당 한 번");
  reload();
  const again = await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(again[0].data.values[0], "a");
  assert.equal(calls.length, 2, "새로 고침 뒤에는 저장된 내용");
  state.version = 8;
  reload();
  await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(calls.length, 3, "'적용'이 바뀌면 다시 받는다");
  assert.deepEqual(Object.keys(window.localStorage).filter(k => k.startsWith("comsw_rows::")), ["comsw_rows::8::main::로드맵"], "예전 번호는 지운다");
});

test("번호 확인이 실패하면 저장 없이 예전처럼 매번 읽는다", async () => {
  const { window, calls } = site({ version: new Error("x"), reply: () => [row(2, ["a"])] });
  await window.ComswSupabase.fetchSheetRows("로드맵");
  window.eval(src("supabase-client.js"));
  await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(calls.length, 2);
  assert.equal(Object.keys(window.localStorage).filter(k => k.startsWith("comsw_rows::")).length, 0);
});

test("미리보기는 저장된 내용을 쓰지 않는다", async () => {
  const { window, calls, state } = site({ page: "item.html?preview=1", token: "tok", reply: () => [row(2, ["a"])] });
  await window.ComswSupabase.fetchSheetRows("로드맵");
  assert.equal(state.versionCalls, 0);
  assert.match(calls[0].url, /comsw_preview_rows$/);
});
