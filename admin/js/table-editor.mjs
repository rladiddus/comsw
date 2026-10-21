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
      const m = dbErrorMessage(error);
      errBox.textContent = m;
      setState(m, true);
      return { ok: false, revert: error.code === "23505" || error.code === "23502" };
    }
    row[column.key] = result.value;
    errBox.textContent = "";
    setState("저장됨");
    return { ok: true, revert: false };
  }

  function inputFor(row, column, errBox) {
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
        button("↑", () => move(index, -1)),
        button("↓", () => move(index, 1)),
        ...extraActions.map(a => button(a.label, () => a.onClick(row))),
        button("삭제", () => remove(row), "danger"),
      ]);
      return el("tr", {}, [...cells, actions]);
    }));
  }

  async function reload() {
    const { data, error } = await filter(supabase.from(table).select("*"))
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) { setState(dbErrorMessage(error), true); return; }
    rows = data;
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
    const { error } = await supabase.from(table).insert({ ...extra, sort_order: nextOrder(rows) });
    if (error) { setState(dbErrorMessage(error), true); return; }
    setState("추가됨");
    await reload();
  });

  reload();
  return { reload };
}
