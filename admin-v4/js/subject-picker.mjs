import { h, table, modal, filterBar, hasText } from "./ui.mjs";

// 과목 고르기 팝업(강사 담당 과목, 학과 구성의 과목 추가): 학과·과목 › 전체 과목과 같은 거르기(과목 검색 · 학과 · 방학 특강 On/Off), 줄을 눌러 체크 → [확인]
export function subjectPicker(title, cat, subjects, chosen, onOk) {
  const pick = new Set(chosen);
  const deptName = new Map(cat.departments.map((d) => [d.id, d.name]));
  const deptsOf = (id) => cat.links.filter((l) => l.subject_id === id).map((l) => deptName.get(l.department_id)).filter(Boolean);
  const vacsOf = (id) => cat.vacLinks.filter((l) => l.subject_id === id).map((l) => cat.vacations.find((v) => v.id === l.set_id)?.name).filter(Boolean);
  const listBox = h("div", { class: "picker-list" });
  const count = h("b");
  const filter = filterBar([
    { key: "name", label: "과목" },
    { key: "dept", label: "학과", options: [["", "전체 학과"], ["-", "학과 없음"], ...cat.departments.map((d) => [d.name, d.name])] },
    { key: "vac", label: "방학 특강", options: [["", "전체"], ["on", "On"], ["off", "Off"]] },
  ], () => draw());
  const draw = () => {
    const f = filter.values;
    const now = subjects.filter((s) => hasText(s.name, f.name)
      && (!f.dept || (f.dept === "-" ? !deptsOf(s.id).length : deptsOf(s.id).includes(f.dept)))
      && (!f.vac || (f.vac === "on") === vacsOf(s.id).length > 0));
    count.textContent = `고른 과목 ${pick.size}개`;
    listBox.replaceChildren(now.length ? table([
      ["", (s) => h("input", { type: "checkbox", checked: pick.has(s.id), "aria-label": `${s.name} 고르기`, tabindex: "-1" })],
      ["과목", (s) => s.name],
      ["학과", (s) => deptsOf(s.id).join(", ") || "—"],
      ["방학 특강", (s) => vacsOf(s.id).join(", ") || "—"],
    ], now, { onPick: (s) => { if (pick.has(s.id)) pick.delete(s.id); else pick.add(s.id); draw(); } }) : h("p", { class: "muted" }, "조건에 맞는 과목이 없습니다"));
  };
  draw();
  const ok = h("button", { type: "button", class: "btn primary" }, "확인");
  const pop = modal(title, h("div", { class: "modal-body" }, filter.el, h("div", { class: "row", style: "margin-bottom:8px" }, count, h("span", { class: "muted" }, "줄을 누르면 고르거나 뺍니다")),
    h("div", { class: "modal-main" }, listBox)), { actions: [ok] });
  pop.dlg.classList.add("modal-mid");
  // 고른 순서: 원래 있던 것 먼저, 새로 고른 것은 뒤에
  ok.onclick = () => { onOk([...chosen.filter((id) => pick.has(id)), ...[...pick].filter((id) => !chosen.includes(id))]); pop.close(); };
}
