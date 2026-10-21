import { toDbValue, dbErrorMessage } from "./fields.mjs";
import { nextOrder, moveUpdates } from "./order.mjs";
import { driveThumbnail } from "./drive.mjs";

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

function imagePreview(url) {
  const img = el("img", { className: "thumb", alt: "" });
  img.addEventListener("error", () => { img.hidden = true; });
  const set = u => { const src = driveThumbnail(u); img.hidden = !src; if (src) img.src = src; };
  set(url);
  return { img, set };
}

// 공용 표 편집기: 줄마다 바로 고치고, 칸을 벗어나거나 체크하면 바로 저장한다.
export function mountTableEditor(container, {
  supabase, table, columns, title, description = "", defaults = {},
  filter = q => q, deleteConfirm = () => "이 줄을 삭제할까요?", extraActions = [],
  orderKey = "sort_order", movable = true, duplicateMessage,
}) {
  const state = el("span", { className: "save-state" });
  const addBtn = el("button", { type: "button", className: "ghost-btn", textContent: "+ 추가" });
  const tbody = el("tbody");
  const head = el("tr", {}, [...columns.map(c => el("th", { textContent: c.label })), el("th", { textContent: "" })]);
  container.append(
    ...(title ? [el("h3", { textContent: title })] : []),
    ...(description ? [el("p", { className: "desc", textContent: description })] : []),
    el("div", { className: "editor-bar" }, [addBtn, state]),
    el("table", { className: "editor" }, [el("thead", {}, [head]), tbody]),
  );

  let rows = [];
  const setState = (text, isError = false) => { state.textContent = text; state.classList.toggle("err", isError); };

  // 반환값 revert: 값 자체가 잘못된 경우(형식·필수·중복)만 원래 값으로 되돌린다.
  // 네트워크·권한 같은 서버 쪽 실패는 입력한 글을 남겨 다시 시도할 수 있게 한다.
  async function save(row, column, raw, errBox) {
    const result = toDbValue(column, raw);
    if (result.error) { errBox.textContent = result.error; setState(result.error, true); return { ok: false, revert: true }; }
    setState("저장 중…");
    const { error } = await supabase.from(table).update({ [column.key]: result.value }).eq("id", row.id);
    if (error) {
      const m = dbErrorMessage(error, { duplicate: duplicateMessage });
      errBox.textContent = m;
      setState(m, true);
      return { ok: false, revert: error.code === "23505" || error.code === "23502" };
    }
    row[column.key] = result.value;
    errBox.textContent = "";
    setState("저장됨");
    return { ok: true, revert: false };
  }

  // 연결표(다대다)는 칩으로: 줄마다 연결된 값을 보여주고, 목록에서 고른 이름으로 더하고, ×로 뺀다.
  const links = {};
  let datalistSeq = 0;
  async function loadLinks() {
    for (const c of columns.filter(c => c.type === "links")) {
      links[c.key] = new Map(rows.map(r => [r.id, []]));
      if (!rows.length) continue;
      const cols = [c.own, c.other, ...(c.ordered ? ["sort_order"] : [])].join(", ");
      const { data, error } = await supabase.from(c.through).select(cols).in(c.own, rows.map(r => r.id));
      if (error) { setState(dbErrorMessage(error), true); continue; }
      const sorted = c.ordered ? [...data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) : data;
      for (const l of sorted) links[c.key].get(l[c.own])?.push({ value: l[c.other], sort_order: l.sort_order });
    }
  }

  function linksCell(row, column) {
    const list = links[column.key]?.get(row.id) ?? [];
    const labelOf = v => column.options.find(o => o.value === v)?.label ?? v;
    const wrap = el("div", { className: "links" });
    const draw = () => {
      const chips = list.map(item => {
        const x = el("button", { type: "button", textContent: "×", title: "빼기" });
        x.addEventListener("click", async () => {
          setState("저장 중…");
          const { error } = await supabase.from(column.through).delete().eq(column.own, row.id).eq(column.other, item.value);
          if (error) { setState(dbErrorMessage(error), true); return; }
          list.splice(list.indexOf(item), 1);
          setState("저장됨");
          draw();
        });
        return el("span", { className: "chip" }, [el("span", { textContent: labelOf(item.value) }), x]);
      });
      const listId = `links-${++datalistSeq}`;
      const input = el("input", { type: "text", className: "link-input", placeholder: "추가…" });
      input.setAttribute("list", listId);
      const datalist = el("datalist", { id: listId }, column.options.map(o => el("option", { value: o.label })));
      input.addEventListener("change", async () => {
        const option = column.options.find(o => o.label === input.value.trim());
        if (!option) { setState("목록에 없는 항목입니다", true); return; }
        if (list.some(i => i.value === option.value)) { input.value = ""; return; }
        const sort_order = column.ordered ? list.reduce((m, i) => Math.max(m, i.sort_order ?? -1), -1) + 1 : undefined;
        setState("저장 중…");
        const { error } = await supabase.from(column.through)
          .insert({ [column.own]: row.id, [column.other]: option.value, ...(column.ordered ? { sort_order } : {}) });
        if (error) { setState(dbErrorMessage(error), true); return; }
        list.push({ value: option.value, sort_order });
        setState("저장됨");
        draw();
      });
      wrap.replaceChildren(...chips, input, datalist);
    };
    draw();
    return [wrap];
  }

  function inputFor(row, column, errBox) {
    if (column.type === "links") return linksCell(row, column);
    const value = row[column.key];
    if (column.type === "checkbox") {
      const input = el("input", { type: "checkbox", checked: Boolean(value) });
      input.addEventListener("change", () => save(row, column, input.checked, errBox));
      return [input];
    }
    if (column.type === "select") {
      const input = el("select", {}, column.options.map(o => el("option", { value: o.value, textContent: o.label })));
      input.value = value ?? "";
      input.addEventListener("change", () => save(row, column, input.value, errBox));
      return [input];
    }
    // 숫자 칸도 text로 둔다: type=number는 브라우저에 따라 '25명'을 빈 값으로 넘겨 조용히 지워진다.
    const input = column.type === "textarea"
      ? el("textarea", { value: value ?? "" })
      : el("input", { type: "text", value: value ?? "", ...(column.type === "number" ? { inputMode: "numeric" } : {}) });
    const preview = column.type === "image" ? imagePreview(value) : null;
    input.addEventListener("change", async () => {
      const { revert } = await save(row, column, input.value, errBox);
      if (revert) input.value = row[column.key] ?? "";
      preview?.set(input.value);
    });
    return preview ? [input, preview.img] : [input];
  }

  function render() {
    tbody.replaceChildren(...rows.map((row, index) => {
      const errBox = el("div", { className: "row-err" });
      const cells = columns.map((c, i) => el("td", {}, [...inputFor(row, c, errBox), ...(i === 0 ? [errBox] : [])]));
      const button = (text, onClick, cls = "") => {
        const b = el("button", { type: "button", textContent: text, className: cls });
        b.addEventListener("click", onClick);
        return b;
      };
      const actions = el("td", { className: "actions" }, [
        ...(movable ? [button("↑", () => move(index, -1)), button("↓", () => move(index, 1))] : []),
        ...extraActions.map(a => button(a.label, () => a.onClick(row))),
        button("삭제", () => remove(row), "danger"),
      ]);
      return el("tr", {}, [...cells, actions]);
    }));
  }

  async function reload() {
    const { data, error } = await filter(supabase.from(table).select("*"))
      .order(orderKey, { ascending: true, nullsFirst: false });
    if (error) { setState(dbErrorMessage(error), true); return; }
    rows = data;
    await loadLinks();
    render();
  }

  async function move(index, delta) {
    const updates = moveUpdates(rows, index, delta);
    if (!updates.length) return;
    setState("저장 중…");
    for (const u of updates) {
      const { error } = await supabase.from(table).update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) { setState(dbErrorMessage(error), true); return; }
    }
    setState("저장됨");
    await reload();
  }

  async function remove(row) {
    let message;
    try {
      message = await deleteConfirm(row);
    } catch (err) {
      setState(err.message, true);
      return;
    }
    if (!confirm(message)) return;
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) { setState(dbErrorMessage(error), true); return; }
    setState("삭제됨");
    await reload();
  }

  addBtn.addEventListener("click", async () => {
    const extra = typeof defaults === "function" ? defaults(rows) : defaults;
    const order = orderKey === "sort_order" ? { sort_order: nextOrder(rows) } : {};
    const { error } = await supabase.from(table).insert({ ...order, ...extra });
    if (error) { setState(dbErrorMessage(error), true); return; }
    setState("추가됨");
    await reload();
  });

  reload();
  return { reload, rows: () => rows };
}
