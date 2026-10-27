import { dbErrorMessage } from "./fields.mjs";
import { moveUpdates, nextOrder } from "./order.mjs";
import { mountImageUpload } from "./image-upload.mjs";
import { mediaPreview } from "./media-preview.mjs";

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// '수정'을 누르면 주소 칸이 열리고 이미지 직접 올리기가 안내 글 자리에 나타난다(카드 크기 그대로).
// 버튼은 '저장'(주황)으로 바뀌고, 누르면 onSave 후 다시 '수정'.
export function editableUpload(onUploaded, { input, hint, onSave = async () => true } = {}) {
  const zone = el("div", { hidden: true, className: "media-upload" });
  mountImageUpload(zone, { label: "이미지 직접 올리기", onUploaded });
  const button = el("button", { type: "button", className: "ghost-btn", textContent: "수정" });
  const setEditing = (on) => {
    zone.hidden = !on;
    if (hint) hint.hidden = on;
    if (input) input.readOnly = !on;
    button.textContent = on ? "저장" : "수정";
    button.className = on ? "publish-btn" : "ghost-btn";
  };
  setEditing(false);
  button.addEventListener("click", async () => {
    if (zone.hidden) {
      setEditing(true);
      input?.focus?.();
      return;
    }
    button.disabled = true;
    try {
      if ((await onSave()) !== false) setEditing(false);
    } finally {
      button.disabled = false;
    }
  });
  return { zone, button };
}

// 메인 화면 > 배경 미디어. 왼쪽 미리보기(번호·좌우 버튼), 오른쪽 주소·문구와 사용·수정·추가·삭제.
// 고친 칸은 바로 저장한다(공개 사이트에는 '사이트에 반영' 후).
export async function mountMediaCarousel(container, { supabase }) {
  const state = el("span", { className: "save-state" });
  const box = el("section", { className: "media-editor" });
  container.append(
    el("h3", { textContent: "배경 미디어" }),
    el("p", {
      className: "desc",
      textContent:
        "메인 화면 배경으로 나오는 이미지·영상과 문구입니다. 사용에 체크한 것만 나옵니다. 좌우 버튼으로 하나씩 확인하세요.",
    }),
    el("div", { className: "editor-bar" }, [state]),
    box,
  );
  const setState = (text, err = false) => {
    state.textContent = text;
    state.classList.toggle("err", err);
  };
  let rows = [];
  let index = 0;
  async function load() {
    const { data, error } = await supabase.from("main_media").select("*")
      .order("sort_order", { ascending: true, nullsFirst: false });
    if (error) return setState(dbErrorMessage(error), true);
    rows = data || [];
    index = Math.min(index, Math.max(rows.length - 1, 0));
    draw();
  }
  async function save(row, patch) {
    setState("저장 중…");
    const { error } = await supabase.from("main_media").update(patch).eq("id", row.id);
    if (error) {
      setState(dbErrorMessage(error), true);
      return false;
    }
    Object.assign(row, patch);
    setState("저장됨");
    return true;
  }
  async function add() {
    const { error } = await supabase.from("main_media").insert({
      url: "",
      caption: "",
      is_active: false,
      sort_order: nextOrder(rows),
    });
    if (error) return setState(dbErrorMessage(error), true);
    index = rows.length;
    await load();
    setState("추가했습니다. 주소를 넣어주세요.");
  }
  async function move(delta) {
    for (const u of moveUpdates(rows, index, delta)) {
      const { error } = await supabase.from("main_media").update({ sort_order: u.sort_order }).eq("id", u.id);
      if (error) return setState(dbErrorMessage(error), true);
    }
    index += delta;
    await load();
  }
  async function remove(row) {
    if (!confirm(`${index + 1}번 배경 미디어를 삭제할까요?`)) return;
    const { error } = await supabase.from("main_media").delete().eq("id", row.id);
    if (error) return setState(dbErrorMessage(error), true);
    await load();
    setState("삭제했습니다");
  }
  const button = (text, onClick, cls = "ghost-btn") => {
    const b = el("button", { type: "button", className: cls, textContent: text });
    b.addEventListener("click", onClick);
    return b;
  };

  function draw() {
    if (!rows.length) {
      box.replaceChildren(
        el("p", { className: "muted", textContent: "아직 배경 미디어가 없습니다." }),
        button("+ 추가", add, "publish-btn"),
      );
      return;
    }
    const row = rows[index];
    const stage = el("div", { className: "media-stage" }, [mediaPreview(row.url)]);
    const prev = button("‹", () => { index--; draw(); }, "media-nav prev");
    const next = button("›", () => { index++; draw(); }, "media-nav next");
    prev.disabled = index === 0;
    next.disabled = index === rows.length - 1;
    prev.setAttribute("aria-label", "이전");
    next.setAttribute("aria-label", "다음");
    const badge = el("span", {
      className: `media-badge${row.is_active ? "" : " off"}`,
      textContent: `${index + 1}번 / ${rows.length}${row.is_active ? "" : " · 사용 안 함"}`,
    });
    stage.append(badge, ...(rows.length > 1 ? [prev, next] : []));

    const url = el("input", { type: "text", value: row.url || "", placeholder: "https://… 이미지·영상 주소(유튜브·구글 드라이브 가능)" });
    const hint = el("p", { className: "muted", textContent: "영상은 주소로 넣어주세요(유튜브·비메오·구글 드라이브·mp4 등). 이미지는 '수정'에서 직접 올릴 수 있습니다." });
    const editor = editableUpload(async (asset) => {
      url.value = asset.url;
      stage.replaceChildren(mediaPreview(asset.url), ...stage.querySelectorAll(".media-badge, .media-nav"));
    }, {
      input: url,
      hint,
      onSave: async () => {
        const value = url.value.trim();
        if (!value) {
          setState("이미지/영상 주소를 입력해주세요", true);
          return false;
        }
        if (value === row.url) return true;
        if (!(await save(row, { url: value }))) return false;
        draw();
        return true;
      },
    });
    const caption = el("textarea", { value: row.caption || "", placeholder: "배경 위에 나오는 문구(줄바꿈 가능)" });
    caption.addEventListener("change", () => save(row, { caption: caption.value }));
    const active = el("input", { type: "checkbox", checked: Boolean(row.is_active) });
    active.addEventListener("change", async () => {
      if (await save(row, { is_active: active.checked })) draw();
    });
    const order = [];
    if (index > 0) order.push(button("앞으로", () => move(-1)));
    if (index < rows.length - 1) order.push(button("뒤로", () => move(1)));

    // 왼쪽 미리보기 / 오른쪽 [주소 | 문구] 위, 버튼 아래. 두 쪽 높이는 같게(CSS).
    box.replaceChildren(
      el("div", { className: "media-card" }, [
        stage,
        el("div", { className: "media-side" }, [
          el("div", { className: "media-top" }, [
            el("div", { className: "media-url" }, [
              el("label", { className: "form-field" }, [el("span", { textContent: "이미지/영상 주소" }), url]),
              hint,
              editor.zone,
            ]),
            el("label", { className: "form-field media-caption" }, [el("span", { textContent: "문구" }), caption]),
          ]),
          el("div", { className: "media-actions" }, [
            el("label", { className: "consent" }, [active, el("span", { textContent: "사용" })]),
            editor.button,
            button("+ 추가", add, "publish-btn"),
            ...order,
            button("삭제", () => remove(row), "ghost-btn danger"),
          ]),
        ]),
      ]),
    );
  }
  await load();
}
