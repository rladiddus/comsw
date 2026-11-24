// AI 사용량: 이번 달 사용액·한도·남은 금액, 종류별 합계, 작업 기록(학과장·관리자가 봄).
// [한도 바꾸기]와 실패한 작업의 [사용액에서 빼기]는 관리자만(권한은 DB가 다시 확인). 홈페이지 내용과 상관없어 바로 저장.
import * as data from "../data.mjs";
import { formatSeoul } from "../../../admin/js/format.mjs";
import { h, head, box, table, pill, fill, note, busy, modal, filterBar } from "../ui.mjs";

const KIND = { week: "강사 단계 문구", common: "공통 4단계 정리", department: "과정내용 정리", roadmap: "로드맵 문구", profile: "프로필 사진" };
const won = (n) => `${Number(n ?? 0).toLocaleString("ko-KR")}원`;
const STUCK = 10 * 60 * 1000; // 서버는 150초 안에 끝난다. 10분 넘게 '진행 중'이면 멈춘 작업(DB 함수와 같은 기준)
export const stuck = (j, now = Date.now()) => j.status === "reserved" && now - new Date(j.created_at).getTime() > STUCK;
const statusOf = (j) => (j.status === "completed" ? ["완료", ""] : j.status === "failed" ? ["실패", "warn"] : stuck(j) ? ["멈춤", "warn"] : ["진행 중", "neutral"]);

// 종류별: 건수·합계·성공 1건 평균·실패 건수(금액 큰 순)
export function byKind(jobs) {
  return Object.keys(KIND).map((kind) => {
    const list = jobs.filter((j) => j.kind === kind);
    const done = list.filter((j) => j.status === "completed");
    const sum = (a) => a.reduce((n, j) => n + j.budget_krw, 0);
    return { kind, count: list.length, total: sum(list), avg: done.length ? Math.round(sum(done) / done.length) : null, failed: list.filter((j) => j.status === "failed").length };
  }).filter((r) => r.count).sort((a, b) => b.total - a.total);
}

export async function render({ main, session }) {
  main.replaceChildren(head("AI 사용량", "이번 달 AI 사용액과 한도, 작업별 금액을 봅니다."));
  const body = h("div");
  main.append(body);
  const reload = () => render({ main, session });
  const admin = session.role === "admin";
  await fill(body, async () => {
    const [budget, jobs] = await Promise.all([
      data.call("comsw_ai_budget"),
      data.all("comsw_ai_jobs", (q) => q.order("created_at", { ascending: false })),
    ]);
    const msg = h("div");
    const limitBtn = admin ? h("button", { type: "button", class: "btn primary", onclick: () => limitPopup(budget.limit, reload) }, "한도 바꾸기") : null;
    const summary = box(null,
      h("div", { class: "row" }, h("h3", {}, `${budget.month.replace("-", "년 ")}월`), limitBtn),
      h("div", { class: "usage-nums" }, [["사용액", budget.used], ["남은 금액", budget.remaining], ["한 달 한도", budget.limit]]
        .map(([t, n]) => h("div", {}, h("span", { class: "muted" }, t), h("b", {}, won(n))))),
      h("meter", { class: "usage-meter", min: 0, max: Math.max(1, budget.limit), value: Math.min(budget.used, budget.limit), "aria-label": `한도 ${won(budget.limit)} 중 ${won(budget.used)} 사용` }),
      note("금액은 실제 청구액이 아니라 프로그램이 넉넉하게 계산한 금액입니다. 실패한 작업은 실제로 돈이 나갔는지 알 수 없어 잡아 둔 금액이 사용액에 남습니다."));

    const kinds = byKind(jobs.filter((j) => j.month === budget.month));
    const kindBox = box("이번 달 종류별", table([
      ["종류", (r) => KIND[r.kind]], ["작업", (r) => `${r.count}건`], ["사용액", (r) => won(r.total)],
      ["성공 1건 평균", (r) => (r.avg == null ? "—" : won(r.avg))], ["실패", (r) => (r.failed ? pill(`${r.failed}건`, "warn") : "—")],
    ], kinds));

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
    const draw = (v) => {
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
    ], draw);
    draw(filter.values);
    return [msg, summary, kindBox, filter.el, listBox];
  });
}

function limitPopup(now, reload) {
  const msg = h("div");
  const input = h("input", { type: "number", min: 0, max: 1000000, step: 1000, value: now, "aria-label": "한 달 한도(원)" });
  const save = h("button", { type: "button", class: "btn primary" }, "저장");
  const pop = modal("한도 바꾸기", h("section", { class: "box", style: "margin:0" }, msg,
    h("label", { class: "form-field" }, h("b", {}, "한 달 한도(원)"), input),
    h("p", { class: "muted" }, "저장하면 바로 적용됩니다. 0원이면 AI를 쓰지 않습니다.")), { actions: [save] });
  pop.dlg.classList.add("modal-small");
  save.onclick = () => busy(save, msg, async () => {
    const n = Number(input.value);
    if (input.value.trim() === "" || !Number.isInteger(n) || n < 0 || n > 1000000) throw new Error("0원부터 1,000,000원까지 숫자로 써주세요");
    await data.call("comsw_set_ai_limit", { p_limit: n });
    pop.close();
    reload();
  });
}
