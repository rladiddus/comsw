// 준비물 입력(2026-11-11): [분류 ▾ 물품·교재·AI 도구][내용][링크(AI 도구일 때)][추가] → 아래에 '분류 · 내용 −' 목록, 제목 옆 '없음' 체크.
// 내 커리큘럼(선생님, 운영 화면과 공용)이 쓴다. V3 승인 대기는 [준비물 작성] 팝업(같은 값 모양)을 쓴다.
// 값은 instructor_subject_materials의 supplies·textbook·ai 칸(20261111010000): 물품·교재는 쉼표로 이은 글,
// AI 도구는 한 줄에 하나 '이름 | 링크'(링크는 없어도 됨, 승인 때 수업별 준비물의 링크 칸으로).
// cats=false(운영 SQL 실행 전, 교재·AI 도구 칸이 없음)면 물품만 고를 수 있다.
import { el } from "./teacher-workspace.mjs";

export const PREP_CATS = [["supply", "물품"], ["textbook", "교재"], ["ai", "AI 도구"]];
export const splitPrep = (s) => String(s ?? "").split(/[,\n\r]+/).map((x) => x.trim()).filter(Boolean);
const key = (x) => x.replace(/\s/g, "").toLowerCase();

// AI 도구 칸: 한 줄에 '이름 | 링크'
export const aiTools = (s) => String(s ?? "").split(/[\n\r]+/).map((line) => {
  const [name, ...rest] = line.split("|");
  return { name: name.trim(), link: rest.join("|").trim() };
}).filter((x) => x.name);
export const aiText = (list) => list.map((x) => (x.link ? `${x.name} | ${x.link}` : x.name)).join("\n") || null;
// 링크는 http(s)만: 다른 형식(javascript: 등)은 버리고, 형식이 없으면 https://를 붙인다(승인 SQL·공개 사이트와 같은 규칙).
export const safeLink = (link) => { const u = String(link ?? "").trim(); return /^https?:\/\//i.test(u) ? u : /^[a-z][a-z0-9+.-]*:/i.test(u) ? "" : u ? `https://${u}` : ""; };

// values = { supply, textbook, ai } (글), none = 처음 '없음' 체크
export function prepItems({ values = {}, none = false, cats = true, label = "준비물" } = {}) {
  let list = [
    ...splitPrep(values.supply).map((text) => ({ cat: "supply", text })),
    ...splitPrep(values.textbook).map((text) => ({ cat: "textbook", text })),
    ...aiTools(values.ai).map((x) => ({ cat: "ai", text: x.name, link: x.link })),
  ];
  const noneBox = el("input", { type: "checkbox", checked: none });
  noneBox.setAttribute("aria-label", `${label} 없음`);
  const cat = el("select", {}, PREP_CATS.map(([k, t]) => el("option", { value: k, textContent: t, disabled: !cats && k !== "supply" })));
  cat.setAttribute("aria-label", `${label} 분류`);
  if (!cats) cat.title = "교재·AI 도구는 운영 SQL(20261111010000) 실행 뒤에 고를 수 있습니다";
  const text = el("input", { type: "text", maxLength: 200, placeholder: "예: 멘토시리즈 포토샵, 이어폰" });
  text.setAttribute("aria-label", `${label} 내용`);
  const link = el("input", { type: "text", inputMode: "url", maxLength: 500, placeholder: "링크(https://…)", hidden: true });
  link.setAttribute("aria-label", `${label} 링크`);
  const add = el("button", { type: "button", className: "ghost-btn", textContent: "추가" });
  const box = el("div", { className: "prep-list" });
  const node = el("div", { className: "prep-items" }, [
    el("div", { className: "prep-head" }, [el("span", { textContent: label }), el("label", { className: "prep-none" }, [noneBox, el("span", { textContent: "없음" })])]),
    el("div", { className: "prep-add" }, [cat, text, link, add]),
    box,
  ]);
  const isAi = () => cat.value === "ai";
  const draw = () => {
    [cat, text, link, add].forEach((x) => { x.disabled = noneBox.checked; });
    link.hidden = !isAi();
    text.placeholder = isAi() ? "AI 도구 이름(예: ChatGPT)" : "예: 멘토시리즈 포토샵, 이어폰";
    box.replaceChildren(...(noneBox.checked ? [el("small", { className: "muted", textContent: "준비물 없음" })]
      : list.length ? list.map((it) => el("span", { className: "prep-chip" }, [
        el("b", { textContent: PREP_CATS.find(([k]) => k === it.cat)[1] }), el("span", { textContent: it.text }),
        ...(safeLink(it.link) ? [el("a", { href: safeLink(it.link), target: "_blank", rel: "noopener", textContent: "링크" })] : []),
        Object.assign(el("button", { type: "button", className: "prep-x", textContent: "−", title: `${it.text} 빼기` }), { onclick: () => { list = list.filter((x) => x !== it); draw(); } }),
      ])) : [el("small", { className: "muted", textContent: "분류를 고르고 내용을 적은 뒤 [추가]를 누르세요." })]));
  };
  // 적어 둔 것: 물품·교재는 쉼표로 여러 개, AI 도구는 이름 하나 + 링크. 이미 있는 항목(띄어쓰기·대소문자 무시)은 건너뜀.
  const pending = () => (isAi()
    ? (text.value.trim() ? [{ cat: "ai", text: text.value.trim(), link: safeLink(link.value) }] : [])
    : splitPrep(text.value).map((t) => ({ cat: cat.value, text: t })))
    .filter((x, i, all) => !list.some((y) => key(y.text) === key(x.text)) && all.findIndex((y) => key(y.text) === key(x.text)) === i);
  const push = () => {
    list.push(...pending());
    text.value = ""; link.value = "";
    draw();
    text.focus?.();
  };
  add.addEventListener("click", push);
  [text, link].forEach((x) => x.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); push(); } }));
  cat.addEventListener("change", draw);
  noneBox.addEventListener("change", () => { if (noneBox.checked) list = []; draw(); });
  draw();
  // 적었지만 [추가]를 안 누른 글도 값에 넣는다(잊고 저장해도 빠지지 않게).
  const value = () => {
    if (noneBox.checked) return { supply: null, textbook: null, ai: null };
    const all = [...list, ...pending()];
    const of = (k) => all.filter((x) => x.cat === k);
    return { supply: of("supply").map((x) => x.text).join(", ") || null, textbook: of("textbook").map((x) => x.text).join(", ") || null,
      ai: aiText(of("ai").map((x) => ({ name: x.text, link: x.link }))) };
  };
  return { node, value, none: noneBox };
}
