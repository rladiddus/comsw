// 준비물 입력(2026-11-11): [분류 ▾ 물품·교재·AI 도구][내용][추가] → 아래에 '분류 · 내용 −' 목록, 오른쪽 위 '없음' 체크.
// 내 커리큘럼(선생님)과 V3 승인 대기 ② 과목별 커리큘럼이 같이 쓴다.
// 값은 분류마다 쉼표로 이은 글(instructor_subject_materials의 supplies·textbook·ai 칸, 20261111010000).
// cats=false(운영 SQL 실행 전, 교재·AI 도구 칸이 없음)면 물품만 고를 수 있다.
import { el } from "./teacher-workspace.mjs";

export const PREP_CATS = [["supply", "물품"], ["textbook", "교재"], ["ai", "AI 도구"]];
const split = (s) => String(s ?? "").split(/[,\n\r]+/).map((x) => x.trim()).filter(Boolean);
const key = (x) => x.replace(/\s/g, "").toLowerCase();

// values = { supply, textbook, ai } (글), none = 처음 '없음' 체크
export function prepItems({ values = {}, none = false, cats = true, label = "준비물" } = {}) {
  let list = PREP_CATS.flatMap(([k]) => split(values[k]).map((text) => ({ cat: k, text })));
  const noneBox = el("input", { type: "checkbox", checked: none });
  noneBox.setAttribute("aria-label", `${label} 없음`);
  const cat = el("select", {}, PREP_CATS.map(([k, t]) => el("option", { value: k, textContent: t, disabled: !cats && k !== "supply" })));
  cat.setAttribute("aria-label", `${label} 분류`);
  if (!cats) cat.title = "교재·AI 도구는 운영 SQL(20261111010000) 실행 뒤에 고를 수 있습니다";
  const text = el("input", { type: "text", maxLength: 200, placeholder: "예: 멘토시리즈 포토샵, 이어폰" });
  text.setAttribute("aria-label", `${label} 내용`);
  const add = el("button", { type: "button", className: "ghost-btn", textContent: "추가" });
  const box = el("div", { className: "prep-list" });
  const node = el("div", { className: "prep-items" }, [
    el("div", { className: "prep-head" }, [el("span", { textContent: label }), el("label", { className: "prep-none" }, [noneBox, el("span", { textContent: "없음" })])]),
    el("div", { className: "prep-add" }, [cat, text, add]),
    box,
  ]);
  const draw = () => {
    [cat, text, add].forEach((x) => { x.disabled = noneBox.checked; });
    box.replaceChildren(...(noneBox.checked ? [el("small", { className: "muted", textContent: "준비물 없음" })]
      : list.length ? list.map((it) => el("span", { className: "prep-chip" }, [
        el("b", { textContent: PREP_CATS.find(([k]) => k === it.cat)[1] }), el("span", { textContent: it.text }),
        Object.assign(el("button", { type: "button", className: "prep-x", textContent: "−", title: `${it.text} 빼기` }), { onclick: () => { list = list.filter((x) => x !== it); draw(); } }),
      ])) : [el("small", { className: "muted", textContent: "분류를 고르고 내용을 적은 뒤 [추가]를 누르세요." })]));
  };
  // 쉼표로 여러 개를 한 번에 넣을 수 있다. 이미 있는 항목(띄어쓰기·대소문자 무시)은 건너뜀.
  const push = () => {
    for (const t of split(text.value)) if (!list.some((x) => key(x.text) === key(t))) list.push({ cat: cat.value, text: t });
    text.value = "";
    draw();
    text.focus?.();
  };
  add.addEventListener("click", push);
  text.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); push(); } });
  noneBox.addEventListener("change", () => { if (noneBox.checked) list = []; draw(); });
  draw();
  // 적었지만 [추가]를 안 누른 글도 값에 넣는다(잊고 저장해도 빠지지 않게).
  const value = () => {
    if (noneBox.checked) return { supply: null, textbook: null, ai: null };
    const all = [...list, ...split(text.value).filter((t) => !list.some((x) => key(x.text) === key(t))).map((t) => ({ cat: cat.value, text: t }))];
    return Object.fromEntries(PREP_CATS.map(([k]) => [k, all.filter((x) => x.cat === k).map((x) => x.text).join(", ") || null]));
  };
  return { node, value, none: noneBox };
}
