// AI 사용량: 이번 달 사용액·한도·남은 금액, 종류별 합계, 작업 기록(학과장·관리자가 봄).
// 종류를 누르면 팝업에서 그 AI 프롬프트를 보고 고친다(site_settings ai_prompt_<종류> — 서버가 이 글로 AI를 부른다).
// [한도 바꾸기]와 실패한 작업의 [사용액에서 빼기]는 관리자만(권한은 DB가 다시 확인). 홈페이지 내용과 상관없어 바로 저장.
// 탭(2026-11-26): 전체(관리 화면 AI + 홈페이지 챗봇 합계) / 관리 화면 AI / 홈페이지 챗봇. 사용액 옆에 한도 대비 %.
import * as data from "../data.mjs";
import { PROMPTS } from "../../../supabase/functions/comsw-tools/policy.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { h, head, box, table, pill, fill, note, busy, modal, filterBar, tabs } from "../ui.mjs";

const KIND = { week: "강사 단계 문구", common: "공통 4단계 정리", department: "과정내용 정리", roadmap: "로드맵 문구", profile: "프로필 사진" };
const USED = {
  week: "강사 커리큘럼의 [AI 문장 다듬기]",
  common: "학과·과목과 방학 특강의 [AI 공통 정리], 과정내용 줄 수를 맞출 때",
  department: "학과 구성의 과정내용 [AI 정리]",
  roadmap: "로드맵 문구의 AI 요약",
  profile: "강사 프로필의 [AI 프로필 사진 만들기]",
};
const TRIMMED = ["week", "common", "department"]; // data.ai가 끝말(~교육·~제안)을 떼는 종류
const MAX = 4000; // 서버(comsw-tools)가 받는 프롬프트 길이
const won = (n) => `${Number(n ?? 0).toLocaleString("ko-KR")}원`;
// 한도 대비 사용 비율(소수 첫째 자리까지, 한도가 0이면 —)
export const pct = (used, limit) => (limit > 0 ? `${Math.round((Number(used) / limit) * 1000) / 10}%` : "—");
let view = "all"; // 고른 탭(다른 메뉴에 갔다 와도 그대로)
const STUCK = 10 * 60 * 1000; // 서버는 150초 안에 끝난다. 10분 넘게 '진행 중'이면 멈춘 작업(DB 함수와 같은 기준)
export const stuck = (j, now = Date.now()) => j.status === "reserved" && now - new Date(j.created_at).getTime() > STUCK;
const statusOf = (j) => (j.status === "completed" ? ["완료", ""] : j.status === "failed" ? ["실패", "warn"] : stuck(j) ? ["멈춤", "warn"] : ["진행 중", "neutral"]);

// 종류별: 건수·합계·성공 1건 평균·실패 건수(금액 큰 순, 안 쓴 종류도 프롬프트를 고칠 수 있게 보임)
export function byKind(jobs) {
  return Object.keys(KIND).map((kind) => {
    const list = jobs.filter((j) => j.kind === kind);
    const done = list.filter((j) => j.status === "completed");
    const sum = (a) => a.reduce((n, j) => n + j.budget_krw, 0);
    return { kind, count: list.length, total: sum(list), avg: done.length ? Math.round(sum(done) / done.length) : null, failed: list.filter((j) => j.status === "failed").length };
  }).sort((a, b) => b.total - a.total);
}

export async function render({ main, session }) {
  main.replaceChildren(head("AI 사용량", "이번 달 AI 사용액과 한도, 작업별 금액을 봅니다."));
  const body = h("div");
  main.append(body);
  const reload = () => render({ main, session });
  const admin = session.role === "admin";
  await fill(body, async () => {
    const [budget, chat, feedback, jobs] = await Promise.all([
      data.call("comsw_ai_budget"),
      data.call("comsw_chat_budget").catch(() => null), // 챗봇 SQL을 실행하기 전
      data.call("comsw_chat_feedback_list").then((x) => (Array.isArray(x) ? x : null)).catch(() => null), // 상담 평가 SQL을 실행하기 전
      data.all("comsw_ai_jobs", (q) => q.order("created_at", { ascending: false })),
    ]);
    const msg = h("div");
    const limitBtn = admin ? h("button", { type: "button", class: "btn primary", onclick: () => limitPopup("comsw_set_ai_limit", budget.limit, "저장하면 바로 적용됩니다. 0원이면 AI를 쓰지 않습니다.", reload) }, "한도 바꾸기") : null;
    const chatBtn = admin && chat ? h("button", { type: "button", class: "btn primary", onclick: () => limitPopup("comsw_set_chat_limit", chat.limit, "방문자 챗봇만의 한도입니다. 하루에는 한 달 한도의 5분의 1까지 씁니다. 0원이면 챗봇이 답하지 않습니다.", reload) }, "챗봇 한도 바꾸기") : null;
    // 사용액(%)·남은 금액·한 달 한도·막대
    const nums = (used, limit, label) => [
      h("div", { class: "usage-nums" }, [["사용액", won(used), pct(used, limit)], ["남은 금액", won(Math.max(0, limit - used))], ["한 달 한도", won(limit)]]
        .map(([t, n, p]) => h("div", {}, h("span", { class: "muted" }, t), h("b", {}, n, p ? h("small", { class: "usage-pct" }, ` ${p}`) : null)))),
      h("meter", { class: "usage-meter", min: 0, max: Math.max(1, limit), value: Math.min(used, limit), "aria-label": `${label} 한도 ${won(limit)} 중 ${won(used)} 사용(${pct(used, limit)})` }),
    ];
    const title = h("h3", {}, `${budget.month.replace("-", "년 ")}월`);
    const cost = note("금액은 실제 청구액이 아니라 프로그램이 넉넉하게 계산한 금액입니다. 실패한 작업은 실제로 돈이 나갔는지 알 수 없어 잡아 둔 금액이 사용액에 남습니다.");
    const noChat = h("p", { class: "muted" }, "챗봇 준비(SQL 실행)가 끝나면 챗봇 사용액이 나옵니다.");
    const chatUsed = chat?.used ?? 0, chatLimit = chat?.limit ?? 0;
    const SUMMARY = {
      all: () => box(null, h("div", { class: "row" }, title),
        ...nums(budget.used + chatUsed, budget.limit + chatLimit, "전체"),
        table([["구분", (r) => r[0]], ["사용액", (r) => won(r[1])], ["한도 대비", (r) => pct(r[1], r[2])], ["한 달 한도", (r) => won(r[2])]],
          [["관리 화면 AI", budget.used, budget.limit], ...(chat ? [["홈페이지 챗봇", chatUsed, chatLimit]] : [])], { onPick: (r) => pickView(r[0] === "관리 화면 AI" ? "admin" : "chat") }),
        chat ? null : noChat, cost),
      admin: () => box(null, h("div", { class: "row" }, title, limitBtn), ...nums(budget.used, budget.limit, "관리 화면 AI"), cost),
      chat: () => box(null, h("div", { class: "row" }, title, chatBtn),
        ...(chat ? [...nums(chatUsed, chatLimit, "홈페이지 챗봇"), h("p", {}, `이번 달 질문 ${Number(chat.count).toLocaleString("ko-KR")}번`)] : [noChat]),
        h("p", { class: "muted" }, "관리 화면 AI 한도와 따로 셉니다. 방문자가 많이 물어도 관리 화면 AI에는 영향이 없습니다. 대화 내용은 방문자가 상담 평가(별점)를 보낸 경우에만 3개월 보관합니다(전화번호·이메일은 가림).")),
    };
    const page = h("div");
    const tabBar = h("div");
    const pickView = (v) => { view = v; draw(); };
    const draw = () => {
      tabBar.replaceChildren(tabs([["all", "전체"], ["admin", "관리 화면 AI"], ["chat", "홈페이지 챗봇"]], view, pickView, "chips"));
      // 종류별·작업 기록은 관리 화면 AI 것(챗봇은 대화를 남기지 않아 기록이 없음)
      page.replaceChildren(SUMMARY[view](), ...(view === "chat" ? [feedbackBox(feedback, budget.month)] : [kindBox, filter.el, listBox]));
    };

    const kinds = byKind(jobs.filter((j) => j.month === budget.month));
    const kindBox = box("이번 달 종류별", h("p", { class: "muted" }, "종류를 누르면 AI 프롬프트를 보고 고칠 수 있습니다."), table([
      ["종류", (r) => KIND[r.kind]], ["작업", (r) => `${r.count}건`], ["사용액", (r) => won(r.total)],
      ["성공 1건 평균", (r) => (r.avg == null ? "—" : won(r.avg))], ["실패", (r) => (r.failed ? pill(`${r.failed}건`, "warn") : "—")],
    ], kinds, { onPick: (r) => promptPopup(r.kind) }));

    const release = (j) => {
      const b = h("button", { type: "button", class: "btn small" }, "사용액에서 빼기");
      b.onclick = () => busy(b, msg, async () => {
        if (!confirm(`${KIND[j.kind] ?? j.kind} ${won(j.budget_krw)}을 사용액에서 뺄까요?\n\nOpenAI에서 실제로 돈이 나가지 않았는지 확인한 뒤 빼주세요.`)) return;
        await data.call("comsw_release_ai", { p_id: j.id });
        reload();
      });
      return b;
    };
    const months = [...new Set([budget.month, ...jobs.map((j) => j.month)])];
    const listBox = h("div");
    const drawList = (v) => {
      const rows = jobs.filter((j) => (!v.month || j.month === v.month) && (!v.kind || j.kind === v.kind) && (!v.status || j.status === v.status));
      listBox.replaceChildren(box(`작업 기록 ${rows.length}건 · ${won(rows.reduce((n, j) => n + j.budget_krw, 0))}`, table([
        ["시각", (j) => formatSeoul(j.created_at)], ["종류", (j) => KIND[j.kind] ?? j.kind], ["상태", (j) => pill(...statusOf(j))], ["금액", (j) => won(j.budget_krw)],
        ["", (j) => (admin && j.budget_krw > 0 && (j.status === "failed" || stuck(j)) ? release(j) : "")],
      ], rows)));
    };
    const filter = filterBar([
      { key: "month", label: "달", options: [["", "전체"], ...months.map((m) => [m, m])] },
      { key: "kind", label: "종류", options: [["", "전체"], ...Object.entries(KIND)] },
      { key: "status", label: "상태", options: [["", "전체"], ["completed", "완료"], ["reserved", "진행 중"], ["failed", "실패"]] },
    ], drawList);
    drawList(filter.values);
    draw();
    return [msg, tabBar, h("div", { style: "height:12px" }), page];
  });
}

// 상담 평가(2026-11-26): 이번 달 평균·건수·별점별, 최근 3개월 목록(거르기), 줄을 누르면 그 대화
const starsOf = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(n);
export function feedbackBox(list, month) {
  if (!list) return box("상담 평가", h("p", { class: "muted" }, "상담 평가 준비(SQL 실행)가 끝나면 방문자가 남긴 별점과 대화가 나옵니다."));
  const mine = list.filter((f) => formatSeoul(f.created_at).slice(0, 7) === month);
  const avg = mine.length ? (mine.reduce((n, f) => n + f.stars, 0) / mine.length).toFixed(1) : "—";
  const dist = h("div", { class: "fb-dist" }, [5, 4, 3, 2, 1].map((s) => {
    const n = mine.filter((f) => f.stars === s).length;
    return [h("span", {}, `★${s}`), h("span", { class: "fb-bar" }, h("i", { style: `width:${mine.length ? Math.round((n / mine.length) * 100) : 0}%` })), h("span", {}, String(n))];
  }).flat());
  const firstQ = (f) => f.messages.find((m) => m.role === "user")?.content ?? "";
  const rows = h("div");
  const draw = (v) => {
    const shown = list.filter((f) => (v.only !== "low" || f.stars <= 3) && (v.only !== "comment" || f.comment));
    rows.replaceChildren(table([
      ["시각", (f) => formatSeoul(f.created_at)], ["별점", (f) => h("span", { class: "fb-stars" }, starsOf(f.stars))],
      ["한마디 · 첫 질문", (f) => h("div", {}, f.comment || "—", h("div", { class: "muted" }, firstQ(f).slice(0, 60)))],
    ], shown, { onPick: talkPopup }));
  };
  const filter = filterBar([{ key: "only", label: "거르기", options: [["", "전체"], ["low", "3점 이하"], ["comment", "한마디 있는 것"]] }], draw);
  draw(filter.values);
  return box(`상담 평가 · 이번 달 평균 ${avg}점 · ${mine.length}건`, dist,
    h("p", { class: "muted" }, "방문자가 [상담 끝내기]나 채팅창 닫기에서 남긴 별점입니다. 최근 3개월만 보관합니다. 줄을 누르면 그 대화를 봅니다."), filter.el, rows);
}
// 대화 팝업: 내용만큼 높이(화면보다 길면 안에서 스크롤), 너비 760px
function talkPopup(f) {
  const pop = modal(`상담 평가 ${starsOf(f.stars)} · ${formatSeoul(f.created_at)}`, h("div", { class: "modal-body" }, h("div", { class: "modal-main" },
    h("section", { class: "box fb-talk", style: "margin:0" },
      f.comment ? note(`한마디: ${f.comment}`) : null,
      ...f.messages.map((m) => h("div", { class: `fb-msg ${m.role}` }, h("b", {}, m.role === "user" ? "방문자" : "챗봇"), h("p", {}, m.content)))))));
  pop.dlg.classList.add("modal-talk");
}

function limitPopup(rpc, now, help, reload) {
  const msg = h("div");
  const input = h("input", { type: "number", min: 0, max: 1000000, step: 1000, value: now, "aria-label": "한 달 한도(원)" });
  const save = h("button", { type: "button", class: "btn primary" }, "저장");
  const pop = modal("한도 바꾸기", h("section", { class: "box", style: "margin:0" }, msg,
    h("label", { class: "form-field" }, h("b", {}, "한 달 한도(원)"), input),
    h("p", { class: "muted" }, help)), { actions: [save] });
  pop.dlg.classList.add("modal-small");
  save.onclick = () => busy(save, msg, async () => {
    const n = Number(input.value);
    if (input.value.trim() === "" || !Number.isInteger(n) || n < 0 || n > 1000000) throw new Error("0원부터 1,000,000원까지 숫자로 써주세요");
    await data.call(rpc, { p_limit: n });
    pop.close();
    reload();
  });
}

// 프롬프트 팝업: 보기로 열리고 [수정] → [저장](바로 저장, 다음 AI 작업부터). 기본과 같은 글이면 저장값을 비워 기본을 쓴다.
export async function promptPopup(kind) {
  const msg = h("div");
  const body = h("div", { class: "modal-main" });
  const edit = h("button", { type: "button", class: "btn primary", disabled: true }, "수정");
  const reset = h("button", { type: "button", class: "btn", hidden: true }, "기본 프롬프트로");
  let saved = null, editing = false;
  const area = h("textarea", { class: "prompt-text", rows: 12, maxLength: MAX, readOnly: true, "aria-label": `${KIND[kind]} 프롬프트`, oninput: () => paint() });
  const now = () => saved || PROMPTS[kind];
  const state = h("div", { class: "row" });
  const paint = () => {
    area.readOnly = !editing;
    edit.textContent = editing ? "저장" : "수정";
    reset.hidden = !editing || area.value.trim() === PROMPTS[kind];
    state.replaceChildren(saved ? pill("직접 저장한 프롬프트") : pill("기본 프롬프트", "neutral"), h("span", { class: "muted" }, `${area.value.length.toLocaleString()} / ${MAX.toLocaleString()}자`));
  };
  modal(`${KIND[kind]} 프롬프트`, h("section", { class: "box prompt-box" }, msg, body), {
    actions: [reset, edit],
    beforeClose: () => !editing || area.value.trim() === now() || confirm("저장하지 않은 프롬프트가 있습니다. 닫을까요?"),
  }).dlg.classList.add("modal-mid", "modal-fit");
  reset.onclick = () => { area.value = PROMPTS[kind]; paint(); };
  edit.onclick = async () => {
    if (!editing) { editing = true; paint(); area.focus(); return; }
    await busy(edit, msg, async () => {
      const text = area.value.trim();
      if (!text) throw new Error("프롬프트를 써주세요. 처음 글로 돌리려면 [기본 프롬프트로]를 누르세요");
      const value = text === PROMPTS[kind] ? null : text;
      await data.savePrompt(kind, value);
      saved = value;
      editing = false;
      area.value = now();
      msg.replaceChildren(note("저장했습니다. 다음 AI 작업부터 이 프롬프트를 씁니다."));
    });
    paint();
  };
  await fill(body, async () => {
    saved = (await data.settings()).find((s) => s.key === `ai_prompt_${kind}`)?.value?.trim() || null;
    area.value = now();
    edit.disabled = false;
    paint();
    return [h("p", { class: "muted" }, `쓰는 곳: ${USED[kind]}`), state, area,
      TRIMMED.includes(kind) ? h("p", { class: "muted" }, "AI 결과 끝의 '~교육'·'~제안'은 프롬프트와 상관없이 자동으로 뗍니다.") : null].filter(Boolean);
  });
}
