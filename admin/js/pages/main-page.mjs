import { mountTableEditor } from "../table-editor.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { freeName } from "../order.mjs";
import { SITE_PAGES } from "../preview.mjs";
import { mountAiSettings } from '../ai-settings.mjs';
import { mountImageUpload } from '../image-upload.mjs';
import { mountMediaCarousel } from "../media-carousel.mjs";
import { mediaPreview } from "../media-preview.mjs";

const MENU_NAMES = SITE_PAGES.slice(1).map(p => p.name).join(", ");

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

async function settingsForm(container, supabase) {
  const state = el("span", { className: "save-state" });
  const [{ data: settings, error }, { data: sets }] = await Promise.all([
    supabase.from("site_settings").select("key, value"),
    supabase.from("curriculum_sets").select("id, name").is("department_id", null).order("sort_order"),
  ]);
  if (error) { state.textContent = dbErrorMessage(error); state.classList.add("err"); }
  const value = key => settings?.find(s => s.key === key)?.value ?? "";

  async function save(key, v) {
    state.textContent = "저장 중…";
    state.classList.remove("err");
    const { error: e } = await supabase.from("site_settings").upsert({ key, value: v || null });
    state.textContent = e ? dbErrorMessage(e) : "저장됨";
    state.classList.toggle("err", Boolean(e));
  }

  // 배경 미디어와 같은 배치: 왼쪽 미리보기, 오른쪽 이름·주소·올리기.
  function imageCard(key, label) {
    const input = el("input", { type: "text", value: value(key), placeholder: "https://… 이미지 주소" });
    const stage = el("div", { className: "media-stage" });
    const preview = () => stage.replaceChildren(mediaPreview(input.value));
    preview();
    input.addEventListener("change", () => { preview(); save(key, input.value.trim()); });
    const upload = el("div");
    mountImageUpload(upload, { label: "이미지 직접 올리기", onUploaded: async asset => {
      const { error } = await supabase.from("site_settings").upsert({ key, value: asset.url });
      if (error) throw new Error(dbErrorMessage(error));
      input.value = asset.url;
      preview();
    } });
    return el("div", { className: "media-card" }, [
      stage,
      el("div", { className: "media-fields" }, [
        el("h4", { textContent: label }),
        el("label", { className: "form-field" }, [el("span", { textContent: "이미지 주소" }), input]),
        upload,
      ]),
    ]);
  }

  const select = el("select", {}, [
    el("option", { value: "", textContent: "선택 안 함" }),
    ...(sets || []).map(s => el("option", { value: s.id, textContent: s.name })),
  ]);
  select.value = value("vacation_set_id");
  select.addEventListener("change", () => save("vacation_set_id", select.value));

  container.append(
    el("h3", { textContent: "기타 설정" }),
    el("div", { className: "editor-bar" }, [state]),
    imageCard("roadmap_logo_url", "로드맵 로고"),
    el("label", { className: "form-field settings-select" }, [el("span", { textContent: "방학 특강 커리큘럼" }), select]),
    imageCard("vacation_background_url", "방학 특강 배경"),
  );
}

export async function render(container, { supabase, preview }) {
  container.append(el("h2", { textContent: "메인 화면" }));
  await mountMediaCarousel(container, { supabase });
  mountTableEditor(container, {
    supabase,
    table: "menus",
    title: "메뉴",
    description: `메뉴 이름은 사이트 페이지와 연결되어 있어 바꾸면 해당 페이지로 이동하지 않을 수 있습니다: ${MENU_NAMES}. 사용을 꺼 둔 메뉴도 미리보기로 '적용' 전 내용을 볼 수 있습니다.`,
    columns: [
      { key: "name", label: "메뉴 이름", type: "text", required: true },
      { key: "is_active", label: "사용", type: "checkbox" },
      { key: "side", label: "위치", type: "select", options: [{ value: "left", label: "왼쪽" }, { value: "right", label: "오른쪽" }] },
      { key: "sort_order", label: "순서", type: "number" },
    ],
    defaults: rows => ({ name: freeName("새 메뉴", rows, "name"), is_active: false, side: "right" }),
    extraActions: preview ? [
      { label: "미리보기", onClick: row => preview(row.name, false) },
      { label: "태블릿", onClick: row => preview(row.name, true) },
    ] : [],
  });
  await settingsForm(container, supabase);
  await mountAiSettings(container,supabase);
}
