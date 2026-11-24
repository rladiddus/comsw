// 학과 구성 편집(표): 이 학과의 과목과 순서 + 과목마다 기간·과정내용·프로그램(준비물)·학습수준 = 공개 '학과 커리큘럼'.
// 순서는 손잡이(⠿)를 끌어서(놓을 자리 경계에 점선), 키보드는 Alt+↑/↓. 과목 이름을 누르면 공통 커리큘럼 팝업.
// 과정내용: 직접 쓰거나 [AI 정리](체크한 과목만, 과목마다 고른 2·3·4줄로). 비어 있으면 공통 4단계로 먼저 채워 둔다.
// 바꾸면 떠 있는 창 [임시 저장]/[사이트 적용]. 과목 정보는 모든 학과가 같이 쓴다.
import * as data from "../data.mjs";
import { h, box, note, fail, busy } from "../ui.mjs";
import { track } from "../changes.mjs";

export const LEVELS = ["★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];

// from번째를 to번째 자리(옮기기 전 기준, 0..length) 앞으로
export function moveItem(list, from, to) {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to > from ? to - 1 : to, 0, x);
  return next;
}
// '1개월' → '1', 숫자가 없으면 ''
export const months = (duration) => String(duration ?? "").match(/\d+(\.\d+)?/)?.[0] ?? "";
// 공통 4단계 → '01 문구' 줄들(과정내용 처음 채우기·AI 재료)
export const linesFromSteps = (steps) => steps.map((w, i) => `${String(i + 1).padStart(2, "0")} ${(w.summary || w.written || "").trim()}`).join("\n");
// 과정내용 줄 수(2·3·4): 처음 = 지금 적힌 줄 수, 그 밖이면 4
export const LINE_COUNTS = [2, 3, 4];
export const lineCountOf = (text) => { const n = String(text ?? "").split("\n").filter((l) => l.trim()).length; return LINE_COUNTS.includes(n) ? n : 4; };
// 글들을 n묶음으로(4개를 2묶음이면 1·2 / 3·4, 6개를 4묶음이면 1·2 / 3 / 4·5 / 6)
export function groupSteps(texts, n) {
  const out = Array.from({ length: n }, () => []);
  texts.forEach((t, i) => out[Math.floor((i * n) / texts.length)].push(t));
  return out;
}
// AI 결과 → 번호를 뗀 줄들('01 ', '1. ', '1단계: '). '3D …'처럼 글의 숫자는 그대로
export const plainLines = (text) => String(text ?? "").split("\n").map((l) => l.trim().replace(/^(?:0\d[.):]?\s+|\d{1,2}[.):]\s+|\d{1,2}단계\s*:?\s*)/, "")).filter(Boolean);
const numbered = (lines) => lines.map((l, i) => `${String(i + 1).padStart(2, "0")} ${l}`).join("\n");
// 과정내용 AI 정리: n묶음을 n줄로. AI가 줄 수를 어기면 묶음마다 한 문장씩 다시 받아 꼭 n줄로 맞춘다.
// texts = 정리할 글(공통 단계 문구, 없으면 과정내용에 적힌 줄). 글 수가 n보다 적으면 나눌 수 없다.
export async function aiLines(name, texts, n, ai) {
  if (texts.length < n) throw new Error(`정리할 내용이 ${texts.length}개라 ${n}줄로 나눌 수 없습니다. 더 작은 숫자를 골라주세요`);
  const groups = groupSteps(texts, n);
  const lines = plainLines(await ai("department", `[${name}] 모두 ${n}줄로 정리\n${groups.map((g, i) => `${i + 1}단계: ${g.join(" / ")}`).join("\n")}`));
  if (lines.length === n) return numbered(lines);
  const each = await Promise.all(groups.map((g) => ai("common", g.map((t) => `- ${t}`).join("\n"))));
  return numbered(each.map((t) => plainLines(t).join(" ")));
}
// AI 재료: 공통 단계(몇 단계든)가 있으면 그 문구, 없으면 과정내용에 적힌 줄
export function materialOf(steps, text) {
  const fromSteps = steps.map((w) => (w.summary || w.written || "").trim()).filter(Boolean);
  return fromSteps.length ? fromSteps : plainLines(text);
}
const infoOf = (s) => ({ duration: s.duration ?? "", dept_curriculum: s.dept_curriculum ?? "", program: s.program ?? "", level: s.level ?? "" });

export function deptLayout(dept, ordered, allSubjects, { reload, stepPill, openSubject, rename, stepsOf = () => [], msg, activeSwitch = null }) {
  let list = [...ordered];
  const listEl = h("div", { class: "drag-list" });
  const add = h("select", { "aria-label": "넣을 과목" });
  const aiOn = new Set(); // AI 정리할 과목(체크)
  const lineCount = new Map(); // 과목 id → AI 정리 줄 수(화면에서만, 저장 안 함)
  const material = (id) => materialOf(stepsOf(id), info[id].dept_curriculum);
  const countOf = (id) => { if (!lineCount.has(id)) lineCount.set(id, lineCountOf(info[id].dept_curriculum)); return lineCount.get(id); };
  let dragFrom = null;
  // 과목 정보: 기준 = DB, 처음 상태 = DB + 과정내용이 비어 있고 공통 4단계가 있으면 그 줄로 채움
  const baseInfo = Object.fromEntries(allSubjects.map((s) => [s.id, infoOf(s)]));
  let info = JSON.parse(JSON.stringify(baseInfo));
  for (const s of ordered) {
    aiOn.add(s.id);
    const steps = stepsOf(s.id);
    if (!info[s.id].dept_curriculum.trim() && steps.length === 4) info[s.id].dept_curriculum = linesFromSteps(steps);
  }
  const clearMarks = () => listEl.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
  const header = h("div", { class: "dept-head" },
    h("span", {}), h("span", {}, "과목명(단계)"), h("span", {}, "기간"), h("span", {}, "과정내용"), h("span", {}, "프로그램(준비물)"), h("span", {}, "학습수준"));
  const aiBtn = h("button", { type: "button", class: "btn primary" }, "AI 정리");
  aiBtn.onclick = () => busy(aiBtn, msg, async () => {
    const targets = list.filter((s) => aiOn.has(s.id));
    const ready = targets.filter((s) => material(s.id).length);
    if (!targets.length) throw new Error("AI로 정리할 과목을 체크해주세요");
    if (!ready.length) throw new Error("체크한 과목에 정리할 내용이 없습니다. 과목을 눌러 공통 커리큘럼을 정리하거나 과정내용을 써주세요");
    // 한 과목이 실패해도 나머지 결과는 살린다
    const outs = await Promise.allSettled(ready.map((s) => aiLines(s.name, material(s.id), countOf(s.id), data.ai)));
    ready.forEach((s, n) => { if (outs[n].status === "fulfilled") info[s.id].dept_curriculum = outs[n].value; });
    draw();
    const bad = ready.flatMap((s, n) => (outs[n].status === "rejected" ? [`${s.name}(${outs[n].reason?.message ?? outs[n].reason})`] : []));
    const done = ready.length - bad.length;
    if (!done) throw new Error(`AI 정리를 하지 못했습니다: ${bad.join(", ")}`);
    const skipped = targets.length - ready.length;
    msg?.replaceChildren(bad.length ? fail(`정리하지 못한 과목: ${bad.join(", ")}`) : "", note(`${done}개 과목의 과정내용을 AI로 정리했습니다${skipped ? `(내용이 없는 ${skipped}개는 건너뜀)` : ""}. 확인한 뒤 [사이트 적용]을 눌러주세요.`));
  });
  const draw = () => {
    listEl.replaceChildren(header, ...(list.length ? list.map((s, i) => {
      const f = info[s.id];
      // 줄 수 2·3·4: 정리할 내용(공통 단계 또는 과정내용 글)이 있으면 늘 보임. 글을 쓰고 지우면 바로 나타나고 사라짐
      const countEl = h("span", { class: "dept-count", hidden: !material(s.id).length, role: "group", "aria-label": `${s.name} AI 정리 줄 수` }, LINE_COUNTS.map((n) => h("button", {
        type: "button", "aria-pressed": String(countOf(s.id) === n), title: `[AI 정리]를 ${n}줄로(01~0${n})`,
        onclick: (e) => { lineCount.set(s.id, n); for (const b of e.currentTarget.parentElement.children) b.setAttribute("aria-pressed", String(b === e.currentTarget)); },
      }, String(n))));
      const row = h("div", {
        class: "drag-row dept-row", tabindex: "0", "aria-label": `${i + 1}. ${s.name} (손잡이를 끌어서 순서 바꾸기, Alt+↑/↓)`,
        ondragstart: (e) => { dragFrom = i; row.classList.add("dragging"); e.dataTransfer?.setData("text/plain", String(i)); },
        ondragend: () => { dragFrom = null; row.classList.remove("dragging"); row.draggable = false; clearMarks(); },
        ondragover: (e) => {
          if (dragFrom == null) return;
          e.preventDefault();
          const r = row.getBoundingClientRect();
          clearMarks();
          row.classList.add(e.clientY > r.top + r.height / 2 ? "drop-after" : "drop-before");
        },
        ondrop: (e) => {
          e.preventDefault();
          if (dragFrom == null) return;
          const to = i + (row.classList.contains("drop-after") ? 1 : 0);
          list = moveItem(list, dragFrom, to);
          dragFrom = null;
          draw();
        },
        onkeydown: (e) => {
          if (e.target !== row || !e.altKey || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault();
          const to = e.key === "ArrowUp" ? i - 1 : i + 2;
          if (to < 0 || to > list.length) return;
          list = moveItem(list, i, to);
          draw();
          listEl.querySelectorAll(".dept-row")[e.key === "ArrowUp" ? i - 1 : i + 1]?.focus();
        },
      },
      // 손잡이를 잡았을 때만 끌 수 있게(칸 안 글자 고르기와 겹치지 않게)
      h("span", { class: "drag-handle", title: "끌어서 순서 바꾸기", onmousedown: () => { row.draggable = true; }, onmouseup: () => { row.draggable = false; } }, "⠿", h("span", { class: "muted" }, ` ${i + 1}`)),
      h("div", { class: "dept-name" }, h("button", { type: "button", class: "subject-chip", onclick: () => openSubject(s.id) }, s.name), stepPill(s)),
      h("label", { class: "dept-dur" }, h("input", { type: "number", min: "0", step: "1", value: months(f.duration), "aria-label": `${s.name} 기간(개월)`,
        oninput: (e) => { f.duration = e.target.value === "" ? "" : `${e.target.value}개월`; } }), " 개월"),
      h("div", { class: "dept-text" },
        h("textarea", { rows: 4, value: f.dept_curriculum, "aria-label": `${s.name} 과정내용`, placeholder: "01 …\n02 …", oninput: (e) => { f.dept_curriculum = e.target.value; countEl.hidden = !material(s.id).length; } }),
        countEl,
        h("input", { type: "checkbox", class: "dept-ai", checked: aiOn.has(s.id), title: "체크한 과목만 [AI 정리]", "aria-label": `${s.name} AI 정리`,
          onchange: (e) => { if (e.target.checked) aiOn.add(s.id); else aiOn.delete(s.id); } })),
      h("textarea", { rows: 4, value: f.program, "aria-label": `${s.name} 프로그램(준비물)`, oninput: (e) => { f.program = e.target.value; } }),
      h("select", { "aria-label": `${s.name} 학습수준`, onchange: (e) => { f.level = e.target.value; } },
        h("option", { value: "" }, "선택 안 함"), [...new Set([...LEVELS, ...(f.level ? [f.level] : [])])].map((v) => h("option", { value: v, selected: v === f.level }, v))),
      h("button", { type: "button", class: "btn danger", onclick: () => { list.splice(i, 1); draw(); } }, "이 학과에서 빼기"));
      return row;
    }) : [h("p", { class: "muted" }, "과목이 없습니다")]));
    const rest = allSubjects.filter((s) => !list.includes(s)).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    add.replaceChildren(h("option", { value: "" }, "과목 넣기…"), ...rest.map((s) => h("option", { value: s.id }, s.name)));
  };
  add.onchange = () => {
    const s = allSubjects.find((x) => x.id === add.value);
    if (s) { list.push(s); aiOn.add(s.id); draw(); }
  };
  const byId = new Map(allSubjects.map((x) => [x.id, x]));
  track({
    id: `layout:${dept.id}`, slot: "dept-layout", title: `${dept.name} 과목 구성`, baseline: ordered.map((x) => x.id),
    read: () => list.map((x) => x.id), write: (ids) => { list = ids.map((id) => byId.get(id)).filter(Boolean); draw(); },
    apply: (ids) => data.call("comsw_v4_save_department_layout", { p_department: dept.id, p_subjects: ids }),
    onApplied: reload,
  });
  track({
    id: `info:${dept.id}`, slot: "dept-info", title: `${dept.name} 학과 커리큘럼(기간·과정내용·프로그램·학습수준)`, baseline: baseInfo,
    read: () => info, write: (x) => { info = { ...JSON.parse(JSON.stringify(baseInfo)), ...x }; draw(); },
    apply: (x) => data.call("comsw_v4_save_subject_info", {
      p_items: Object.entries(x).filter(([id, v]) => JSON.stringify(v) !== JSON.stringify(baseInfo[id])).map(([id, v]) => ({ id, ...v })),
    }),
    onApplied: reload,
  });
  draw();
  return box(null,
    h("div", { class: "row" },
      h("div", { class: "actions" }, h("h3", { style: "margin:0" }, `${dept.name} · 과목 ${ordered.length}개`),
        h("button", { type: "button", class: "btn", onclick: rename }, "학과명 수정"),
        activeSwitch ? h("span", { class: "actions", title: "끄면 홈페이지에서 이 학과를 숨깁니다" }, h("span", { class: "muted" }, "공개"), activeSwitch) : null),
      h("div", { class: "actions" }, h("span", { class: "pill neutral" }, "이 순서 = 학과별 커리큘럼·로드맵 순서"), aiBtn)),
    note("손잡이(⠿)를 끌어서 순서를 바꿉니다. 기간·과정내용·프로그램·학습수준은 공개 '학과 커리큘럼'에 나오고, 같은 과목을 쓰는 모든 학과에 함께 바뀝니다. 과정내용은 직접 쓰거나 체크한 과목만 [AI 정리](공통 단계, 없으면 적힌 글을 칸 오른쪽 아래에서 고른 2·3·4줄로). 과목 이름을 누르면 공통 커리큘럼이 열립니다."),
    listEl, h("div", { class: "actions", style: "margin-top:12px" }, add));
}
