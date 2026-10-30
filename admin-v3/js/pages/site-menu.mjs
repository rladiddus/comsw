import { el } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";
import { SITE_PAGES } from "../../../admin/js/preview.mjs";

// 사이트 아래 알약 메뉴 편집(기존 '메뉴' 표 대신): 왼쪽 알약 · 가운데 X · 오른쪽 알약.
// 글자를 바로 고치고, ⠿를 끌어 좌우·순서를 옮기고, ×로 지우고, +로 더한다. [저장]을 눌러야 menus 표에 저장된다.
const LINKED = SITE_PAGES.slice(1).map((p) => p.name).join(", ");

export async function menuEditor(container, { supabase }) {
  const state = el("span", { className: "save-state" });
  const { data, error } = await supabase.from("menus").select("id, name, is_active, side, sort_order").order("sort_order");
  if (error) { container.append(el("p", { className: "save-state err", textContent: dbErrorMessage(error) })); return; }
  let items = (data ?? []).map((m) => ({ ...m }));
  const removed = [];
  let dragged = null;
  const save = el("button", { type: "button", className: "publish-btn", textContent: "저장", disabled: true });
  const dirty = () => { save.disabled = false; state.textContent = ""; };
  const sides = { left: el("div", { className: "v3-pills left" }), right: el("div", { className: "v3-pills right" }) };

  function pill(m) {
    const input = el("input", { type: "text", value: m.name, size: Math.max(m.name.length, 3) });
    input.addEventListener("input", () => { m.name = input.value; input.size = Math.max(input.value.length, 3); dirty(); });
    const use = el("input", { type: "checkbox", checked: m.is_active, title: "사이트에 보이기" });
    use.addEventListener("change", () => { m.is_active = use.checked; node.classList.toggle("off", !m.is_active); dirty(); });
    const node = el("div", { className: `v3-pill${m.is_active ? "" : " off"}` }, [
      el("span", { className: "v3-pillgrip", textContent: "⠿", title: "끌어서 옮기기" }), use, input,
      Object.assign(el("button", { type: "button", className: "v3-pillx", textContent: "×", title: "삭제" }), {
        onclick: () => { items = items.filter((x) => x !== m); if (m.id) removed.push(m.id); dirty(); draw(); },
      }),
    ]);
    node.draggable = true;
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
      box.replaceChildren(...items.filter((m) => m.side === side).map(pill), Object.assign(
        el("button", { type: "button", className: "v3-pill v3-pilladd", textContent: "+", title: "메뉴 추가" }),
        { onclick: () => { items.push({ name: "새 메뉴", is_active: false, side }); dirty(); draw(); } },
      ));
    }
  }

  save.onclick = async () => {
    const names = items.map((m) => m.name.trim());
    if (names.some((n) => !n)) { state.textContent = "메뉴 이름을 비울 수 없습니다"; state.classList.add("err"); return; }
    if (new Set(names).size !== names.length) { state.textContent = "같은 이름의 메뉴가 있습니다"; state.classList.add("err"); return; }
    save.disabled = true;
    state.textContent = "저장 중…"; state.classList.remove("err");
    // 순서: 왼쪽 알약 다음 오른쪽 알약(기존 '순서' 칸과 같은 뜻)
    const ordered = [...items.filter((m) => m.side === "left"), ...items.filter((m) => m.side === "right")];
    try {
      if (removed.length) { const { error: e } = await supabase.from("menus").delete().in("id", removed); if (e) throw e; removed.length = 0; }
      for (const [i, m] of ordered.entries()) {
        const row = { name: m.name.trim(), is_active: m.is_active, side: m.side, sort_order: i + 1 };
        const q = m.id ? supabase.from("menus").update(row).eq("id", m.id) : supabase.from("menus").insert(row).select("id").single();
        const { data: saved, error: e } = await q;
        if (e) throw e;
        if (!m.id && saved) m.id = saved.id;
      }
      state.textContent = "저장됨";
    } catch (e) {
      state.textContent = dbErrorMessage(e); state.classList.add("err"); save.disabled = false;
    }
  };

  draw();
  container.append(
    el("div", { className: "v3-menustage" }, [sides.left, el("span", { className: "v3-pillmid", textContent: "✕" }), sides.right]),
    el("div", { className: "v2-actions v2-end", style: "margin-top:12px" }, [state, save]),
    el("p", { className: "muted", textContent: `체크를 끈 알약(흐린 것)은 사이트에 보이지 않습니다. 메뉴 이름은 사이트 페이지와 이어져 있어 바꾸면 그 페이지로 가지 않을 수 있습니다: ${LINKED}. 저장한 뒤 '사이트에 반영'을 눌러야 공개 사이트에 나옵니다.` }),
  );
}
