import test from "node:test";
import assert from "node:assert/strict";
import { as, freshDb } from "./pg.mjs";
import { buildCatalog, keepKnownLinks, tailOf, chatCost, chatInput, createChatHandler, PROMPT } from "../../supabase/functions/comsw-chat/handler.mjs";

const lesson = (dept, name, step, text, extra = {}) => {
  const v = Array(26).fill("");
  Object.assign(v, { 1: dept, 2: name, 3: step, 5: text, 6: "1개월", 9: extra.content ?? "", 10: "Photoshop", 11: "★★" });
  return v;
};
const dept = (name, on) => { const v = Array(26).fill(""); v[14] = name; v[16] = on; v[17] = `${name} 소개`; return v; };
const LESSONS = [
  dept("시각편집학과", "true"), dept("AI학과", "true"), dept("숨긴학과", "false"),
  lesson("시각편집", "AI포토샵", "1단계", "합성"), lesson("시각편집", "AI포토샵", "2단계", "보정"),
  lesson("디자인·IT·AI 자격증", "AI자격증", "1단계", "필기"), lesson("숨긴", "비밀수업", "1단계", "비밀"),
  lesson("AI", "AI자동화", "", "", { content: "01 자동화\n02 실습" }),
];

const menu = (name, on, extra = "") => ["", "", "", "", name, on, "", "", extra];
const SITE = {
  lessons: [...LESSONS, lesson("시각편집", "AI크리에이터 시각편집", "1단계", "숨김")],
  instructors: [
    ["김하나", "시각편집학과, AI학과", "AI포토샵, AI자동화, AI크리에이터 시각편집", "2020 전시\n2021 수상", "즐겁게"],
    ["박두리", "숨긴학과", "비밀수업", "비밀경력", ""],
  ],
  prep: [["포토샵", "교재명", "멘토 포토샵", "https://book.kr/a?b=1", "", "28,000원"], ["", "준비물", "이어폰", "javascript:alert(1)", "", ""], ["", "AI 툴", "GPT", "chatgpt.com", "", ""], ["AI크리에이터 시각편집", "AI 툴", "미드저니", "", "", ""]],
  roadmap: [["시각편집학과", "AI포토샵", "AI크리에이터 아트웍", ""], ["시각편집학과", "", "", ""], ["시각편집학과", "문구", "", ""]],
  seminars: [["", "옛 특강", "소주제", "2026년 8월 5일 11:00-13:00", "김하나", "J강의장", "16", "0"], ["", "새 특강", "", "2027년 1월 3일", "김하나", "", "10", "0"]],
  curricula: {
    시각편집학과: [["김하나", "AI포토샵", "1단계", "", "하나의 합성"], ["김하나", "뺀 과목", "1단계", "", "담당 아님"]],
    AI학과: [["김하나", "AI자동화", "1단계", "", "하나의 자동화"]],
  },
};

test("재료: 보이는 학과의 과목만, 단계가 없으면 과정내용, 학과 이름은 정확히", () => {
  const { text } = buildCatalog({ lessons: LESSONS });
  assert.match(text, /- 시각편집학과: 시각편집학과 소개/);
  assert.match(text, /## AI포토샵\n학과: 시각편집학과\n기간 1개월 · 난이도 ★★ · 프로그램 Photoshop\n내용: 1단계 합성 \/ 2단계 보정/);
  assert.match(text, /## AI자동화\n학과: AI학과[\s\S]*내용: 01 자동화 \/ 02 실습/);
  assert.ok(!/숨긴학과|비밀수업|AI자격증/.test(text), "숨긴 학과, 어느 보이는 학과에도 없는 과목은 빠짐");
});

test("재료: 강사(담당은 그 학과 과목만·경력)·준비물·로드맵·특강, 숨긴 강사와 빼 달라고 한 과목은 어디에도 없음", () => {
  const site = buildCatalog(SITE);
  assert.match(site.text, /## AI포토샵[\s\S]*?담당 선생님: 김하나\n/);
  assert.match(site.text, /## 김하나 선생님\n시각편집학과 담당: AI포토샵\nAI학과 담당: AI자동화\n경력: 2020 전시 \/ 2021 수상\n한마디: 즐겁게/);
  assert.match(site.text, /# 준비물\n- 포토샵: 교재 멘토 포토샵\(28,000원\) https:\/\/book\.kr\/a\?b=1 , 준비물 이어폰 , AI 툴 GPT https:\/\/chatgpt\.com\n?/);
  assert.ok(!site.text.includes("javascript:"));
  assert.match(site.text, /# 로드맵\(배우는 순서\)\n- 시각편집학과: AI포토샵\n/);
  const now = Date.parse("2026-11-25T03:00:00Z");
  const tail = tailOf(site, [{ role: "user", content: "특강 있어?" }], now);
  assert.match(tail, /# 오늘: 2026-11-25[\s\S]*지난 특강: 옛 특강 \(소주제\)[\s\S]*예정 특강: 새 특강/);
  assert.ok(!tail.includes("하나의 합성"), "선생님 이름이 나오지 않으면 수업 내용은 안 붙임");
  const named = tailOf(site, [{ role: "user", content: "김하나 선생님 수업은?" }], now);
  assert.match(named, /## 김하나 선생님\(시각편집학과, AI학과\)\n- 시각편집학과 AI포토샵: 1단계 하나의 합성\n- AI학과 AI자동화: 1단계 하나의 자동화/);
  assert.ok(!/박두리|비밀|AI크리에이터|담당 아님/.test(site.text + named));
});

test("재료: 메뉴에서 끈 페이지의 내용은 빠짐(방학 특강은 켰을 때만)", () => {
  const off = buildCatalog({ ...SITE, menu: ["강사별 커리큘럼", "수업별 준비물", "전체 수업", "특강/세미나"].map((n) => menu(n, "false")) });
  assert.ok(!/# 강사|# 준비물|# 로드맵|선생님/.test(off.text));
  assert.deepEqual([off.teachers.length, off.seminars.length], [0, 0]);
  assert.match(off.text, /## AI포토샵/);
  const none = buildCatalog({ ...SITE, menu: ["학과 커리큘럼", "학과별 자료", "전체 수업"].map((n) => menu(n, "false")) });
  assert.ok(!none.text.includes("## AI포토샵"));
  const vacation = [["강사이름", "웹툰특강", "1단계", "", "콘티"]];
  assert.match(buildCatalog({ ...SITE, vacation, menu: [menu("방학 특강", "true", "겨울특강")] }).text, /# 방학 특강\(겨울특강\)\n- 웹툰특강: 1단계 콘티/);
  assert.ok(!buildCatalog({ ...SITE, vacation, menu: [menu("방학 특강", "false", "겨울특강")] }).text.includes("웹툰특강"));
});

test("답변의 링크: 자료에 있는 주소만 남기고 지어낸 주소는 지움", () => {
  const text = "교재 https://book.kr/a?b=1 , 다른 글";
  assert.equal(keepKnownLinks("구매: https://book.kr/a?b=1", text), "구매: https://book.kr/a?b=1");
  assert.equal(keepKnownLinks("https://book.kr/a?b=1. 또는 https://fake.kr/x", text), "https://book.kr/a?b=1 또는 ");
});

test("대화: 최근 8개, 길이 제한, 마지막은 질문", () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `${i}` }));
  assert.deepEqual(chatInput({ messages: many }).map((m) => m.content), ["4", "5", "6", "7", "8", "9", "10"]);
  assert.equal(chatInput({ messages: [{ role: "system", content: "가".repeat(900) }] })[0].content.length, 500);
  assert.equal(chatInput({ messages: [{ role: "system", content: "x" }] })[0].role, "user", "지시문 역할은 쓸 수 없음");
  for (const bad of [{}, { messages: "x" }, { messages: [null] }, { messages: [{ role: "assistant", content: "x" }] }]) assert.throws(() => chatInput(bad), /질문/);
  assert.equal(chatCost({ input_tokens: 10000, output_tokens: 500 }, 2000), 3);
  assert.equal(chatCost({ input_tokens: 10000, output_tokens: 500, input_tokens_details: { cached_tokens: 9000 } }, 2000), 1);
});

const ENV = { SUPABASE_URL: "https://db", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", OPENAI_API_KEY: "key" };
function setup({ answer = { answer: "시각편집학과의 AI포토샵 수업을 추천합니다.", ask_mentor: false }, reserve, ai = 200, env = ENV } = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    const name = url.split("/").pop();
    const body = JSON.parse(init.body);
    calls.push([name, body, init.headers]);
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
    if (name === "comsw_site_version") return json(7);
    if (name === "comsw_site_rows") return json(body.p_sheet === "컴수원_전체수업" ? LESSONS.map((values) => ({ data: { values } })) : []);
    if (name === "comsw_chat_reserve") return reserve ? json(reserve, 400) : json("id1");
    if (name === "comsw_chat_finish") return new Response(null, { status: 204 });
    return json(ai === 200 ? { output: [{ content: [{ type: "output_text", text: JSON.stringify(answer) }] }], usage: { input_tokens: 5000, output_tokens: 200 } } : { error: { message: "비밀 오류" } }, ai);
  };
  const handler = createChatHandler({ env: (k) => env[k], fetcher });
  const ask = (messages = [{ role: "user", content: "AI로 이미지 만드는 수업" }], headers = {}) =>
    handler(new Request("https://x/comsw-chat", { method: "POST", headers: { Origin: "https://rladiddus.github.io", "x-forwarded-for": "1.2.3.4", ...headers }, body: JSON.stringify({ messages }) }));
  return { handler, ask, calls };
}

test("답변: 커리큘럼을 재료로, 저장 안 함, 실제 금액으로 정산, 접속 주소는 보내지 않음", async () => {
  const { ask, calls } = setup();
  const res = await ask();
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://rladiddus.github.io");
  assert.deepEqual(await res.json(), { reply: "시각편집학과의 AI포토샵 수업을 추천합니다." });
  const ai = calls.find(([n]) => n === "responses")[1];
  assert.equal(ai.store, false);
  assert.deepEqual([ai.model, ai.reasoning, "temperature" in ai], ["gpt-6-luna", { effort: "low" }, false]);
  assert.ok(ai.instructions.startsWith(PROMPT) && ai.instructions.includes("## AI포토샵"));
  const [, reserved, head] = calls.find(([n]) => n === "comsw_chat_reserve");
  assert.equal(head.apikey, "service");
  assert.match(reserved.p_who, /^[0-9a-f]{24}$/);
  assert.ok(!JSON.stringify(calls).includes("1.2.3.4"));
  assert.deepEqual(calls.find(([n]) => n === "comsw_chat_finish")[1], { p_id: "id1", p_krw: 2 });
  assert.equal(calls.find(([n]) => n === "comsw_site_rows")[2].apikey, "anon", "공개된 자료만 읽음");
  await ask();
  assert.equal(calls.filter(([n]) => n === "comsw_site_rows").length, 8, "시트 6개 + 보이는 학과 2개, 같은 번호면 다시 읽지 않음");
});

test("없는 내용이면 '멘토님께 문의해주세요'를 한 번만 덧붙임", async () => {
  const one = await (await setup({ answer: { answer: "수강료는 확인할 수 없습니다.", ask_mentor: true } }).ask()).json();
  assert.equal(one.reply, "수강료는 확인할 수 없습니다.\n\n멘토님께 문의해주세요.");
  const two = await (await setup({ answer: { answer: "확인할 수 없습니다. 멘토님께 문의해주세요.", ask_mentor: true } }).ask()).json();
  assert.equal(two.reply.match(/멘토님께/g).length, 1);
});

test("막기: 다른 사이트·주소 없는 요청·잘못된 질문, 한도·오류 안내(내부 오류는 숨김)", async () => {
  const s = setup();
  for (const Origin of ["https://other.example", undefined]) {
    const res = await s.handler(new Request("https://x", { method: "POST", headers: Origin ? { Origin } : {}, body: "{}" }));
    assert.equal(res.status, 403);
  }
  assert.equal((await s.ask([])).status, 400);
  assert.equal((await s.ask([{ role: "user", content: "가".repeat(30000) }])).status, 400);
  assert.equal(s.calls.length, 0, "막은 요청은 AI·DB를 부르지 않음");
  const full = await setup({ reserve: { code: "P0001", message: "질문이 너무 많습니다." } }).ask();
  assert.deepEqual([full.status, await full.json()], [429, { error: "질문이 너무 많습니다." }]);
  const noSql = await setup({ reserve: { code: "PGRST202", message: "내부 이름" } }).ask();
  assert.equal(noSql.status, 503);
  assert.ok(!(await noSql.text()).includes("내부 이름"));
  const broken = setup({ ai: 500 });
  const res = await broken.ask();
  assert.match((await res.json()).error, /멘토님께 문의해주세요/);
  assert.deepEqual(broken.calls.find(([n]) => n === "comsw_chat_finish")[1], { p_id: "id1", p_krw: 0 }, "거절된 요청은 요금 없음");
  assert.equal((await setup({ env: { ...ENV, OPENAI_API_KEY: "" } }).ask()).status, 503);
});

test("SQL: 서버만 예약, 사람별·전체 횟수, 하루·한 달 금액, 관리 화면 AI 한도와 따로", async () => {
  const db = await freshDb();
  try {
    const reserve = (who, krw) => db.query("select comsw_chat_reserve($1,$2) id", [who, krw]);
    const id = (await reserve("a", 100)).rows[0].id;
    await db.query("select comsw_chat_finish($1, 7)", [id]);
    for (let i = 0; i < 7; i++) await reserve("a", 1);
    await assert.rejects(reserve("a", 1), /질문이 너무 많습니다/);
    await reserve("b", 500);
    await assert.rejects(reserve("b", 100), /멘토님께/, "하루 600원(3,000원의 5분의 1)");
    await db.exec("update comsw_private.chat_calls set created_at = created_at - interval '40 days'");
    await reserve("a", 600);
    await assert.rejects(reserve("a", 0), /잘못된/);

    await as(db, "authenticated", { sub: "h", comsw_role: "head" });
    assert.deepEqual((await db.query("select comsw_chat_budget() b")).rows[0].b, { used: 600, count: 1, limit: 3000 });
    assert.equal((await db.query("select comsw_ai_budget() b")).rows[0].b.used, 0, "관리 화면 AI 사용액에는 안 들어감");
    await assert.rejects(db.query("select comsw_set_chat_limit(0)"), /관리자만/);
    await assert.rejects(reserve("c", 1), /permission denied/);
    await assert.rejects(db.query("select * from comsw_private.chat_calls"), /permission denied/);
    await as(db, "authenticated", { sub: "t", comsw_role: "teacher" });
    await assert.rejects(db.query("select comsw_chat_budget()"), /권한/);
    await as(db, "anon");
    for (const sql of ["select comsw_chat_reserve('x',1)", "select comsw_chat_finish(gen_random_uuid(),0)", "select comsw_chat_budget()", "select comsw_set_chat_limit(1)"]) {
      await assert.rejects(db.query(sql), /permission denied/);
    }
    await as(db, "authenticated", { sub: "m", comsw_role: "admin" });
    await assert.rejects(db.query("select comsw_set_chat_limit(-1)"), /0원부터/);
    await db.query("select comsw_set_chat_limit(0)");
    await as(db, null);
    await assert.rejects(reserve("d", 1), /이용할 수 없습니다/, "0원이면 끔");
  } finally {
    await db.close();
  }
});

test("SQL: 전체 1분 60번", async () => {
  const db = await freshDb();
  try {
    for (let i = 0; i < 60; i++) await db.query("select comsw_chat_reserve($1, 1)", [`p${i}`]);
    await assert.rejects(db.query("select comsw_chat_reserve('new', 1)"), /질문이 너무 많습니다/);
  } finally {
    await db.close();
  }
});
