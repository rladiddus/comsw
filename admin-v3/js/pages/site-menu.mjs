import { el } from "../../../admin-v2/js/ui.mjs";
import { dbErrorMessage } from "../../../admin/js/fields.mjs";

// 사이트 아래 알약 메뉴 편집(기존 '메뉴' 표 대신): 왼쪽 알약 · 가운데 X · 오른쪽 알약.
// 사이트는 메뉴 이름으로 갈 페이지를 정하므로 이름 바꾸기·추가·삭제는 막고, 체크(보이기)와 ⠿ 끌어 좌우·순서 옮기기만.
// [저장]을 눌러야 menus 표에 저장된다.

export async function menuEditor(container, { supabase }) {
  const state = el("span", { className: "save-state" });
  const { data, error } = await supabase.from("menus").select("id, name, is_active, side, sort_order").order("sort_order");
  if (error) { container.append(el("p", { className: "save-state err", textContent: dbErrorMessage(error) })); return; }
  const items = (data ?? []).map((m) => ({ ...m }));
  let dragged = null;
  const save = el("button", { type: "button", className: "publish-btn", textContent: "저장", disabled: true });
  const dirty = () => { save.disabled = false; state.textContent = ""; };
  const sides = { left: el("div", { className: "v3-pills left" }), right: el("div", { className: "v3-pills right" }) };

  function pill(m) {
    const use = el("input", { type: "checkbox", checked: m.is_active, title: "사이트에 보이기" });
    use.addEventListener("change", () => { m.is_active = use.checked; node.classList.toggle("off", !m.is_active); dirty(); });
    const node = el("div", { className: `v3-pill${m.is_active ? "" : " off"}` }, [
      el("span", { className: "v3-pillgrip", textContent: "⠿", title: "끌어서 옮기기" }), use, el("span", { className: "v3-pillname", textContent: m.name }),
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
        const { error: e } = await supabase.from("menus").update({ is_active: m.is_active, side: m.side, sort_order: i + 1 }).eq("id", m.id);
        if (e) throw e;
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
    el("p", { className: "muted", textContent: "체크를 끈 알약(흐린 것)은 사이트에 보이지 않습니다. ⠿를 끌어 좌우·순서를 바꿉니다. 메뉴 이름은 사이트 페이지와 이어져 있어 바꾸거나 더할 수 없습니다. 저장한 뒤 '사이트에 반영'을 눌러야 공개 사이트에 나옵니다." }),
  );
}
