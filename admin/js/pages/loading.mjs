import { dbErrorMessage } from "../fields.mjs";
import { nextOrder } from "../order.mjs";
import { mountImageUpload } from "../image-upload.mjs";
import { mediaPreview } from "../media-preview.mjs";

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

const FIELDS = [
  ["text", "문구", "For Masterpieces"],
  ["font_family", "폰트", "Great Vibes"],
  ["font_size", "폰트 크기", "예) 48px"],
  ["font_weight", "두께", "예) 400, bold"],
];

// 로딩 화면: 줄마다 [⠿ 끌어 옮기기 | 미리보기 | 문구·폰트·크기·두께·사용 / 삭제·수정].
// 수정을 누르면 칸이 열리고 이미지 올리기가 나오며 버튼이 '저장'으로 바뀐다. 사용 체크는 바로 저장.
export async function render(container, { supabase }) {
  const state = el("span", { className: "save-state" });
  const list = el("div", { className: "loading-list" });
  const add = el("button", { type: "button", className: "publish-btn", textContent: "+ 추가" });
  container.append(
    el("h2", { textContent: "로딩 화면" }),
    el("p", {
      className: "desc",
      textContent:
        "페이지를 열 때 무작위로 하나가 보입니다. 사용에 체크한 것만 나옵니다. 왼쪽 ⠿를 끌어 순서를 바꿀 수 있습니다.",
    }),
    el("div", { className: "editor-bar" }, [add, state]),
    list,
  );
  const setState = (text, err = false) => {
    state.textContent = text;
    state.classList.toggle("err", err);
  };
  let rows = [];
  let dragFrom = -1;

  async function load() {
    const { data, error } = await supabase.from("loading_items").select("*")
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) return setState(dbErrorMessage(error), true);
    rows = data || [];
    draw();
  }
  async function update(row, patch) {
    setState("저장 중…");
    const { error } = await supabase.from("loading_items").update(patch).eq("id", row.id);
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
      const { error } = await supabase.from("loading_items").update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) return setState(dbErrorMessage(error), true);
    }
    setState("순서를 바꿨습니다");
    await load();
  }
  add.addEventListener("click", async () => {
    const { error } = await supabase.from("loading_items").insert({
      image_url: "",
      is_active: false,
      sort_order: nextOrder(rows),
    });
    if (error) return setState(dbErrorMessage(error), true);
    await load();
    setState("추가했습니다. 맨 아래에서 '수정'을 눌러 이미지와 문구를 넣어주세요.");
  });

  function card(row, index) {
    const stage = el("div", { className: "loading-stage" });
    const caption = el("span", { className: "loading-caption" });
    const inputs = {};
    const paint = () => {
      const url = inputs.image_url.value.trim();
      stage.replaceChildren(mediaPreview(url), caption);
      caption.textContent = inputs.text.value;
      Object.assign(caption.style, {
        fontFamily: inputs.font_family.value,
        fontSize: inputs.font_size.value,
        fontWeight: inputs.font_weight.value,
      });
    };
    const line = (label, input) =>
      el("label", { className: "loading-line" }, [el("span", { textContent: label }), input]);
    const lines = FIELDS.map(([key, label, placeholder]) => {
      inputs[key] = el("input", { type: "text", value: row[key] ?? "", placeholder, readOnly: true });
      inputs[key].addEventListener("input", paint);
      return line(label, inputs[key]);
    });
    inputs.image_url = el("input", { type: "text", value: row.image_url ?? "", placeholder: "https://… 이미지 주소", readOnly: true });
    inputs.image_url.addEventListener("change", paint);
    const active = el("input", { type: "checkbox", checked: Boolean(row.is_active) });
    active.addEventListener("change", () => update(row, { is_active: active.checked }));
    const upload = el("div", { className: "loading-upload", hidden: true }, [line("이미지 주소", inputs.image_url)]);
    mountImageUpload(upload, {
      label: "이미지 직접 올리기",
      onUploaded: (asset) => {
        inputs.image_url.value = asset.url;
        paint();
      },
    });
    const edit = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
    const remove = el("button", { type: "button", className: "ghost-btn danger", textContent: "삭제" });
    const editing = (on) => {
      upload.hidden = !on;
      for (const input of Object.values(inputs)) input.readOnly = !on;
      edit.textContent = on ? "저장" : "수정";
      edit.className = on ? "publish-btn" : "ghost-btn";
    };
    edit.addEventListener("click", async () => {
      if (upload.hidden) return editing(true);
      const patch = Object.fromEntries(
        [...FIELDS.map(([k]) => k), "image_url"].map((k) => [k, inputs[k].value.trim() || null]),
      );
      if (!patch.image_url) return setState("이미지를 올리거나 주소를 넣어주세요", true);
      edit.disabled = true;
      if (await update(row, patch)) editing(false);
      edit.disabled = false;
    });
    remove.addEventListener("click", async () => {
      if (!confirm(`${index + 1}번 로딩 화면을 삭제할까요?`)) return;
      const { error } = await supabase.from("loading_items").delete().eq("id", row.id);
      if (error) return setState(dbErrorMessage(error), true);
      await load();
      setState("삭제했습니다");
    });
    paint();

    // 끌어서 순서 바꾸기: 손잡이를 잡았을 때만 줄 전체가 끌린다.
    const handle = el("span", { className: "drag-handle", textContent: "⠿", title: "끌어서 순서 바꾸기" });
    const box = el("article", { className: "loading-card" }, [
      handle,
      stage,
      el("div", { className: "loading-side" }, [
        el("div", { className: "loading-fields" }, [
          ...lines,
          el("label", { className: "loading-line" }, [el("span", { textContent: "사용" }), el("span", { className: "consent" }, [active])]),
          upload,
        ]),
        el("div", { className: "media-actions" }, [remove, edit]),
      ]),
    ]);
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
    if (!rows.length) list.append(el("p", { className: "muted", textContent: "아직 로딩 화면이 없습니다." }));
  }
  await load();
}
