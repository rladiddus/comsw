import { mountTableEditor } from "../table-editor.mjs";
import { dbErrorMessage } from "../fields.mjs";
import { driveThumbnail } from "../drive.mjs";

const MENU_NAMES = "전체 수업, 학과별 자료, 학과 커리큘럼, 특강/세미나, 수업별 준비물, 방학 특강";

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

  function imageField(key, label) {
    const input = el("input", { type: "text", value: value(key) });
    const img = el("img", { className: "thumb", alt: "" });
    img.addEventListener("error", () => { img.hidden = true; });
    const preview = () => { const s = driveThumbnail(input.value); img.hidden = !s; if (s) img.src = s; };
    preview();
    input.addEventListener("change", () => { preview(); save(key, input.value.trim()); });
    return [el("label", { textContent: label }), input, img];
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
    el("div", { className: "settings-form" }, [
      ...imageField("roadmap_logo_url", "로드맵 로고"),
      el("label", { textContent: "방학 특강 커리큘럼" }), select,
      ...imageField("vacation_background_url", "방학 특강 배경"),
    ]),
  );
}

export async function render(container, { supabase }) {
  container.append(el("h2", { textContent: "메인 화면" }));
  mountTableEditor(container, {
    supabase,
    table: "main_media",
    title: "배경 미디어",
    description: "메인 화면 배경으로 나오는 이미지·영상과 문구입니다. 사용에 체크한 것만 나옵니다.",
    columns: [
      { key: "url", label: "이미지/영상 주소", type: "image", required: true },
      { key: "caption", label: "문구", type: "textarea" },
      { key: "is_active", label: "사용", type: "checkbox" },
    ],
    defaults: { url: "", is_active: false },
  });
  mountTableEditor(container, {
    supabase,
    table: "menus",
    title: "메뉴",
    description: `메뉴 이름은 사이트 페이지와 연결되어 있어 바꾸면 해당 페이지로 이동하지 않을 수 있습니다: ${MENU_NAMES}`,
    columns: [
      { key: "name", label: "메뉴 이름", type: "text", required: true },
      { key: "is_active", label: "사용", type: "checkbox" },
      { key: "side", label: "위치", type: "select", options: [{ value: "left", label: "왼쪽" }, { value: "right", label: "오른쪽" }] },
      { key: "sort_order", label: "순서", type: "number" },
    ],
    defaults: rows => ({ name: `새 메뉴 ${rows.length + 1}`, is_active: false, side: "right" }),
  });
  await settingsForm(container, supabase);
}
