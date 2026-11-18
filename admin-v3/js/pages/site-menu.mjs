import { el } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";

// 사이트 아래 알약 메뉴 편집(기존 '메뉴' 표 대신): 왼쪽 알약 · 가운데 X · 오른쪽 알약.
// 사이트는 메뉴 이름(name)으로 갈 페이지를 정하므로 추가·삭제는 막고, 체크(보이기)·⠿ 끌어 좌우·순서 옮기기·글자 고치기만.
// 글자는 보이는 이름(label, 2026-11-18)만 바뀐다: name은 그대로, 사이트·사이트 페이지 목록에 label이 나온다(비우면 원래 이름).
// [저장]을 눌러야 menus 표에 저장된다. label 칸이 없으면(SQL 20261118010000 실행 전) 글자는 못 고친다.

export async function menuEditor(container, { supabase, onSaved }) {
  const state = el("span", { className: "save-state" });
  let labels = true;
  let { data, error } = await supabase.from("menus").select("id, name, label, is_active, side, sort_order").order("sort_order");
  if (error) {
    labels = false;
    ({ data, error } = await supabase.from("menus").select("id, name, is_active, side, sort_order").order("sort_order"));
  }
  if (error) { container.append(el("p", { className: "save-state err", textContent: dbErrorMessage(error) })); return; }
  const items = (data ?? []).map((m) => ({ ...m }));
  let dragged = null;
  const save = el("button", { type: "button", className: "publish-btn", textContent: "저장", disabled: true });
  const dirty = () => { save.disabled = false; state.textContent = ""; };
  const sides = { left: el("div", { className: "v3-pills left" }), right: el("div", { className: "v3-pills right" }) };

  function pill(m) {
    // 글자 고치기: 칸 너비는 글자 수만큼. 비우면 원래 이름으로.
    const name = el("input", { type: "text", className: "v3-pillname", value: m.label || m.name, title: labels ? `글자를 고치면 사이트 메뉴 이름이 바뀝니다(원래 이름: ${m.name})` : "글자 고치기는 SQL 실행 뒤에 됩니다", readOnly: !labels });
    name.setAttribute("aria-label", `${m.name} 메뉴 이름`);
    const fit = () => { name.size = Math.max(2, [...name.value].length + 1); };
    fit();
    name.addEventListener("input", () => { fit(); const v = name.value.trim(); m.label = v && v !== m.name ? v : null; dirty(); });
    name.addEventListener("blur", () => { if (!name.value.trim()) { name.value = m.name; fit(); } });
    const use = el("input", { type: "checkbox", checked: m.is_active, title: "사이트에 보이기" });
    use.addEventListener("change", () => { m.is_active = use.checked; node.classList.toggle("off", !m.is_active); dirty(); });
    const node = el("div", { className: `v3-pill${m.is_active ? "" : " off"}` }, [
      el("span", { className: "v3-pillgrip", textContent: "⠿", title: "끌어서 옮기기" }), use, name,
    ]);
    node.draggable = true;
    name.addEventListener("mousedown", () => { node.draggable = false; });
    name.addEventListener("mouseup", () => { node.draggable = true; });
    name.addEventListener("blur", () => { node.draggable = true; });
    node.addEventListener("dragstart", (e) => { if (e.target !== node) return; dragged = m; e.dataTransfer?.setData("text/plain", m.name); });
    node.addEventListener("dragend", () => { dragged = null; clear(); });
    node.addEventListener("dragover", (e) => {
      if (!dragged || dragged === m) return;
      e.preventDefault(); e.stopPropagation(); clear();
      node.classList.add(after(e, node) ? "drop-after" : "drop-before");
    });
    node.addEventListener("drop", (e) => {
      if (!dragged || dragged === m) return;
      e.preventDefault(); e.stopPropagation();
      move(dragged, m.side, items.indexOf(m) + (after(e, node) ? 1 : 0));
    });
    return node;
  }
  const after = (e, node) => { const b = node.getBoundingClientRect(); return e.clientX > b.left + b.width / 2; };
  const clear = () => container.querySelectorAll(".v3-pill").forEach((n) => n.classList.remove("drop-before", "drop-after"));
  function move(m, side, index) {
    const at = items.indexOf(m);
    items.splice(at, 1);
    items.splice(index > at ? index - 1 : index, 0, m);
    m.side = side;
    dirty(); draw();
  }
  // 빈 자리(알약 사이가 아닌 곳)에 놓으면 그쪽 맨 끝으로.
  for (const [side, box] of Object.entries(sides)) {
    box.addEventListener("dragover", (e) => { if (dragged) e.preventDefault(); });
    box.addEventListener("drop", (e) => {
      if (!dragged) return;
      e.preventDefault();
      const last = items.filter((x) => x.side === side).at(-1);
      move(dragged, side, last ? items.indexOf(last) + 1 : items.length);
    });
  }

  function draw() {
    for (const [side, box] of Object.entries(sides)) {
      box.replaceChildren(...items.filter((m) => m.side === side).map(pill));
    }
  }

  save.onclick = async () => {
    save.disabled = true;
    state.textContent = "저장 중…"; state.classList.remove("err");
    // 순서: 왼쪽 알약 다음 오른쪽 알약(기존 '순서' 칸과 같은 뜻)
    const ordered = [...items.filter((m) => m.side === "left"), ...items.filter((m) => m.side === "right")];
    try {
      for (const [i, m] of ordered.entries()) {
        const { error: e } = await supabase.from("menus").update({ is_active: m.is_active, side: m.side, sort_order: i + 1, ...(labels ? { label: m.label || null } : {}) }).eq("id", m.id);
        if (e) throw e;
      }
      state.textContent = "저장됨";
      onSaved?.();
    } catch (e) {
      state.textContent = dbErrorMessage(e); state.classList.add("err"); save.disabled = false;
    }
  };

  draw();
  container.append(
    el("div", { className: "v3-menustage" }, [sides.left, el("span", { className: "v3-pillmid", textContent: "✕" }), sides.right]),
    el("div", { className: "v2-actions v2-end", style: "margin-top:12px" }, [state, save]),
    el("p", { className: "muted", textContent: "체크를 끈 알약(흐린 것)은 사이트에 보이지 않습니다. ⠿를 끌어 좌우·순서를 바꿉니다. 알약 글자를 눌러 메뉴 이름을 고칠 수 있습니다(사이트 메뉴·사이트 페이지 목록에 같이 바뀜, 비우면 원래 이름). 메뉴를 더하거나 지울 수는 없습니다. 저장한 뒤 '사이트에 반영'을 눌러야 공개 사이트에 나옵니다." }),
  );
}

// 학과 커리큘럼 사이트 위쪽 학과 탭 두 줄 편집(2026-11-17): 사용 체크한 학과를 끌어 윗줄·아랫줄·순서를 정한다.
// 놓을 자리는 탭 경계에 점선으로 미리 보인다. 저장 = 학과 순서(departments.sort_order) + 윗줄 개수(site_settings 'dept_tab_top').
// 사이트는 학과 순서대로 앞의 N개를 윗줄, 나머지를 아랫줄로 그린다(값이 없으면 예전처럼 5개).
export const DEPT_TAB_TOP = "dept_tab_top";

export async function deptTabsEditor(container, { supabase }) {
  const say = el("span", { className: "save-state" });
  const [{ data: depts, error }, { data: settings }] = await Promise.all([
    supabase.from("departments").select("id, name, is_active, sort_order").order("sort_order"),
    supabase.from("site_settings").select("key, value"),
  ]);
  if (error) { container.append(el("p", { className: "save-state err", textContent: dbErrorMessage(error) })); return; }
  const all = depts ?? [];
  const shown = all.filter((d) => d.is_active);
  const saved = Number.parseInt(settings?.find((s) => s.key === DEPT_TAB_TOP)?.value, 10);
  const top = Number.isFinite(saved) && saved > 0 ? saved : 5;
  const rows = [shown.slice(0, top), shown.slice(top)];
  let dragged = null;
  const save = el("button", { type: "button", className: "publish-btn", textContent: "저장", disabled: true });
  const boxes = rows.map(() => el("div", { className: "v3-tabrow" }));
  const after = (e, node) => { const b = node.getBoundingClientRect(); return e.clientX > b.left + b.width / 2; };
  const clear = () => container.querySelectorAll(".drop-before, .drop-after, .drop-end").forEach((n) => n.classList.remove("drop-before", "drop-after", "drop-end"));
  function move(d, row, index) {
    rows.forEach((r) => { const i = r.indexOf(d); if (i >= 0) { r.splice(i, 1); if (r === rows[row] && i < index) index--; } });
    rows[row].splice(index, 0, d);
    save.disabled = !rows[0].length; // 윗줄이 비면 저장 안 함
    say.textContent = rows[0].length ? "" : "윗줄에 학과를 하나 이상 두세요.";
    draw();
  }
  function tab(d, row) {
    const node = el("div", { className: "v3-tabitem", textContent: d.name, title: "끌어서 옮기기" });
    node.draggable = true;
    node.addEventListener("dragstart", (e) => { dragged = d; e.dataTransfer?.setData("text/plain", d.name); });
    node.addEventListener("dragend", () => { dragged = null; clear(); });
    node.addEventListener("dragover", (e) => {
      if (!dragged || dragged === d) return;
      e.preventDefault(); e.stopPropagation(); clear();
      node.classList.add(after(e, node) ? "drop-after" : "drop-before");
    });
    node.addEventListener("drop", (e) => {
      if (!dragged || dragged === d) return;
      e.preventDefault(); e.stopPropagation(); clear();
      move(dragged, row, rows[row].indexOf(d) + (after(e, node) ? 1 : 0));
    });
    return node;
  }
  // 탭 사이가 아닌 빈 자리에 놓으면 그 줄 맨 끝(줄 테두리 점선으로 표시).
  boxes.forEach((box, row) => {
    box.addEventListener("dragover", (e) => { if (!dragged) return; e.preventDefault(); clear(); box.classList.add("drop-end"); });
    box.addEventListener("dragleave", (e) => { if (!box.contains(e.relatedTarget)) box.classList.remove("drop-end"); });
    box.addEventListener("drop", (e) => { if (!dragged) return; e.preventDefault(); clear(); move(dragged, row, rows[row].length); });
  });
  function draw() {
    boxes.forEach((box, row) => box.replaceChildren(...rows[row].map((d) => tab(d, row))));
  }

  save.onclick = async () => {
    save.disabled = true;
    say.textContent = "저장 중…"; say.classList.remove("err");
    // 보이는 학과를 새 순서로 앞에, 사용 안 하는 학과는 원래 순서대로 뒤에.
    const order = [...rows[0], ...rows[1], ...all.filter((d) => !d.is_active)];
    try {
      for (const [i, d] of order.entries()) {
        if (d.sort_order === i) continue;
        const { error: e } = await supabase.from("departments").update({ sort_order: i }).eq("id", d.id);
        if (e) throw e;
        d.sort_order = i;
      }
      const { error: e } = await supabase.from("site_settings").upsert({ key: DEPT_TAB_TOP, value: String(rows[0].length) });
      if (e) throw e;
      say.textContent = "저장됨 · 공개 사이트는 '사이트에 반영' 후 바뀝니다";
    } catch (e) {
      say.textContent = dbErrorMessage(e); say.classList.add("err"); save.disabled = false;
    }
  };

  draw();
  container.append(
    el("div", { className: "v3-tabstage" }, [
      el("span", { className: "v3-tablabel", textContent: "윗줄" }), boxes[0],
      el("span", { className: "v3-tablabel", textContent: "아랫줄" }), boxes[1],
    ]),
    el("div", { className: "v2-actions v2-end", style: "margin-top:12px" }, [say, save]),
    el("p", { className: "muted", textContent: "학과 탭을 끌어 윗줄·아랫줄과 순서를 바꿉니다. 놓을 자리는 점선으로 보입니다. 학과 순서는 '학과별 자료'·학과 드롭다운 순서와 같습니다. 사용 체크를 끈 학과는 나오지 않습니다(기본 설정 › '학과별 자료')." }),
  );
}
