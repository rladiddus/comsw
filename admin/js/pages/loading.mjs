import { mountTableEditor } from "../table-editor.mjs";

export function render(container, { supabase }) {
  const h2 = document.createElement("h2");
  h2.textContent = "로딩 화면";
  const desc = document.createElement("p");
  desc.className = "desc";
  desc.textContent = "페이지를 열 때 무작위로 하나가 보입니다. 사용에 체크한 것만 나옵니다.";
  container.append(h2, desc);
  mountTableEditor(container, {
    supabase,
    table: "loading_items",
    columns: [
      { key: "image_url", label: "이미지", type: "image", required: true },
      { key: "text", label: "문구", type: "text" },
      { key: "is_active", label: "사용", type: "checkbox" },
      { key: "font_family", label: "폰트", type: "text" },
      { key: "font_size", label: "폰트 크기", type: "text" },
      { key: "font_weight", label: "두께", type: "text" },
    ],
    defaults: { image_url: "", is_active: false },
  });
}
