import { dbErrorMessage } from "./fields.mjs";
import { nextOrder } from "./order.mjs";
import { mountImageUpload } from "./image-upload.mjs";
import { mediaPreview } from "./media-preview.mjs";

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// 끌어 놓은 자리로 옮긴 뒤 0..n-1로 다시 매기고, 순서가 바뀐 줄만 돌려준다.
export function reorderUpdates(rows, from, to) {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return [];
  const ids = rows.map((r) => r.id);
  ids.splice(to, 0, ...ids.splice(from, 1));
  return ids
    .map((id, sort_order) => ({ id, sort_order }))
    .filter((u) => rows.find((r) => r.id === u.id).sort_order !== u.sort_order);
}

// 카드 목록 편집기(로딩 화면·학과 등).
// 줄마다 [⠿ 끌어 옮기기 | 이미지 미리보기 | 칸들(2열) / 사용·삭제·수정·접기]. imageSide:'right'면 이미지가 오른쪽.
// '수정'을 누르면 칸이 열리고 이미지 주소·직접 올리기가 나오며 버튼이 '저장'(주황). 사용 체크는 바로 저장.
// 처음에는 접힌 채로 보인다. 접으면 미리보기가 작아지고 칸들이 한 줄('이름 : 값 · …'), 접은 채로도 수정·저장(이미지는 펼쳐서).
// fields: [{ key, label, type: 'text'|'textarea'|'select', options?(values) => [[값, 글자]], fallback?, required?, wide?, placeholder? }]
export async function mountCardList(container, {
  supabase,
  table,
  title,
  description,
  fields,
  imageKey = "image_url",
  imageLabel = "이미지",
  imageRequired = false,
  imageSide = "left",
  activeKey = "is_active",
  defaults = () => ({}),
  deleteConfirm = async (row, index) => `${index + 1}번을 삭제할까요?`,
  preview = (values) => [mediaPreview(values[imageKey])],
  itemName = (row, index) => `${index + 1}번`,
}) {
  const state = el("span", { className: "save-state" });
  const list = el("div", { className: "card-list" });
  const add = el("button", { type: "button", className: "publish-btn", textContent: "+ 추가" });
  const foldAll = el("button", { type: "button", className: "ghost-btn", textContent: "모두 펼치기" });
  container.append(
    ...(title ? [el("h3", { textContent: title })] : []),
    ...(description ? [el("p", { className: "desc", textContent: description })] : []),
    el("div", { className: "editor-bar" }, [add, foldAll, state]),
    list,
  );
  const setState = (text, err = false) => {
    state.textContent = text;
    state.classList.toggle("err", err);
  };
  let rows = [];
  let dragFrom = -1;
  // 처음 보이는 카드는 접힌 채로. '+ 추가'로 만든 카드만 펼쳐서 바로 쓰게 한다.
  const collapsed = new Set();
  const seen = new Set();
  let expandNew = false;

  async function load() {
    const { data, error } = await supabase.from(table).select("*")
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) return setState(dbErrorMessage(error), true);
    rows = data || [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      if (!expandNew) collapsed.add(r.id);
    }
    expandNew = false;
    draw();
  }
  async function update(row, patch) {
    setState("저장 중…");
    const { error } = await supabase.from(table).update(patch).eq("id", row.id);
    if (error) {
      setState(dbErrorMessage(error), true);
      return false;
    }
    Object.assign(row, patch);
    setState("저장됨");
    return true;
  }
  async function reorder(from, to) {
    for (const u of reorderUpdates(rows, from, to)) {
      const { error } = await supabase.from(table).update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) return setState(dbErrorMessage(error), true);
    }
    setState("순서를 바꿨습니다");
    await load();
  }
  add.addEventListener("click", async () => {
    const { error } = await supabase.from(table).insert({
      ...defaults(rows),
      [activeKey]: false,
      sort_order: nextOrder(rows),
    });
    if (error) return setState(dbErrorMessage(error), true);
    expandNew = true;
    await load();
    setState("추가했습니다. 맨 아래에서 '수정'을 눌러 내용을 넣어주세요.");
  });
  foldAll.addEventListener("click", () => {
    const fold = foldAll.textContent === "모두 접기";
    for (const r of rows) {
      if (fold) collapsed.add(r.id);
      else collapsed.delete(r.id);
    }
    foldAll.textContent = fold ? "모두 펼치기" : "모두 접기";
    draw();
  });

  function card(row, index) {
    const stage = el("div", { className: "card-stage" });
    const inputs = {};
    const values = () => Object.fromEntries([...fields.map((f) => f.key), imageKey].map((k) => [k, inputs[k].value]));
    // 선택 칸: 목록에 없는 예전 값은 '(현재) 값'으로 남긴다. 다른 칸 값에 따라 목록이 바뀔 수 있다.
    const fillSelect = (f, value) => {
      const select = inputs[f.key];
      const list = f.options(values());
      select.replaceChildren(...list.map(([v, label]) => el("option", { value: v, textContent: label })));
      if (value && !list.some(([v]) => v === value)) {
        select.prepend(el("option", { value, textContent: `(현재) ${value}` }));
      }
      select.value = value || f.fallback || list[0]?.[0] || "";
    };
    const paint = () => stage.replaceChildren(...preview(values()));
    const line = (label, input, wide = false) =>
      el("label", { className: `card-line${wide ? " wide" : ""}` }, [el("span", { textContent: label }), input]);
    const lines = fields.map((f) => {
      if (f.type === "select") {
        inputs[f.key] = el("select", { disabled: true });
      } else if (f.type === "textarea") {
        inputs[f.key] = el("textarea", { value: row[f.key] ?? "", placeholder: f.placeholder ?? "", readOnly: true, rows: 3 });
      } else {
        inputs[f.key] = el("input", { type: "text", value: row[f.key] ?? "", placeholder: f.placeholder ?? "", readOnly: true });
      }
      return line(f.label, inputs[f.key], f.wide);
    });
    inputs[imageKey] = el("input", { type: "text", value: row[imageKey] ?? "", placeholder: "https://… 이미지 주소", readOnly: true });
    for (const f of fields.filter((f) => f.type === "select")) fillSelect(f, row[f.key]);
    for (const f of fields) {
      inputs[f.key].addEventListener(f.type === "select" ? "change" : "input", () => {
        // 다른 칸에 따라 바뀌는 선택 칸(예: 폰트 → 두께)을 다시 채운다.
        for (const g of fields) if (g !== f && g.type === "select" && g.dependsOn === f.key) fillSelect(g, "");
        paint();
      });
    }
    inputs[imageKey].addEventListener("change", paint);
    const active = el("input", { type: "checkbox", checked: Boolean(row[activeKey]) });
    active.addEventListener("change", () => update(row, { [activeKey]: active.checked }));
    const upload = el("div", { className: "card-upload", hidden: true }, [line(`${imageLabel} 주소`, inputs[imageKey], true)]);
    mountImageUpload(upload, {
      label: "이미지 직접 올리기",
      onUploaded: (asset) => {
        inputs[imageKey].value = asset.url;
        paint();
      },
    });
    const edit = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
    const remove = el("button", { type: "button", className: "ghost-btn danger", textContent: "삭제" });
    const fold = el("button", { type: "button", className: "ghost-btn fold-btn" });
    const editing = (on) => {
      upload.hidden = !on;
      for (const input of Object.values(inputs)) {
        if (input.tagName === "SELECT") input.disabled = !on;
        else input.readOnly = !on;
      }
      edit.textContent = on ? "저장" : "수정";
      edit.className = on ? "publish-btn" : "ghost-btn";
    };
    edit.addEventListener("click", async () => {
      if (upload.hidden) return editing(true);
      const v = values();
      const missing = fields.find((f) => f.required && !v[f.key].trim());
      if (missing) return setState(`${missing.label}을(를) 입력해주세요`, true);
      if (imageRequired && !v[imageKey].trim()) return setState("이미지를 올리거나 주소를 넣어주세요", true);
      edit.disabled = true;
      const patch = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() || null]));
      if (await update(row, patch)) editing(false);
      edit.disabled = false;
    });
    remove.addEventListener("click", async () => {
      if (!confirm(await deleteConfirm(row, index))) return;
      const { error } = await supabase.from(table).delete().eq("id", row.id);
      if (error) return setState(dbErrorMessage(error), true);
      await load();
      setState(`${itemName(row, index)}을(를) 삭제했습니다`);
    });
    paint();

    const handle = el("span", { className: "drag-handle", textContent: "⠿", title: "끌어서 순서 바꾸기" });
    const side = el("div", { className: "card-side" }, [
      el("div", { className: "card-fields" }, lines),
      upload,
      el("div", { className: "media-actions" }, [
        el("label", { className: "consent" }, [active, el("span", { textContent: "사용" })]),
        remove,
        edit,
        fold,
      ]),
    ]);
    const box = el("article", { className: `card-item image-${imageSide}` }, [
      handle,
      ...(imageSide === "right" ? [side, stage] : [stage, side]),
    ]);
    const setFolded = (on) => {
      box.classList.toggle("collapsed", on);
      fold.textContent = on ? "펼치기" : "접기";
      fold.setAttribute("aria-expanded", String(!on));
      if (on) collapsed.add(row.id);
      else collapsed.delete(row.id);
    };
    fold.addEventListener("click", () => setFolded(!box.classList.contains("collapsed")));
    setFolded(collapsed.has(row.id));
    // 끌어서 순서 바꾸기: 손잡이를 잡았을 때만 줄 전체가 끌린다.
    handle.addEventListener("pointerdown", () => { box.draggable = true; });
    box.addEventListener("dragstart", (e) => {
      dragFrom = index;
      e.dataTransfer?.setData?.("text/plain", String(index));
      box.classList.add("dragging");
    });
    box.addEventListener("dragend", () => {
      box.draggable = false;
      box.classList.remove("dragging");
    });
    box.addEventListener("dragover", (e) => {
      e.preventDefault();
      box.classList.add("drag-over");
    });
    box.addEventListener("dragleave", () => box.classList.remove("drag-over"));
    box.addEventListener("drop", (e) => {
      e.preventDefault();
      box.classList.remove("drag-over");
      if (dragFrom >= 0) reorder(dragFrom, index);
      dragFrom = -1;
    });
    return box;
  }

  function draw() {
    list.replaceChildren(...rows.map(card));
    if (!rows.length) list.append(el("p", { className: "muted", textContent: "아직 항목이 없습니다." }));
  }
  await load();
  return { reload: load };
}
