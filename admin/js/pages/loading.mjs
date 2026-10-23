import { mountCardList } from "../card-list.mjs";
import { mediaPreview } from "../media-preview.mjs";
import { LOADING_FONTS, LOADING_SIZES, fontOf, loadPreviewFonts } from "../loading-fonts.mjs";

export { reorderUpdates } from "../card-list.mjs";

// 로딩 화면: [⠿ | 미리보기(문구를 그 폰트로) | 문구·폰트 / 폰트 크기·두께(그 폰트가 가진 두께) / 사용·삭제·수정·접기].
export async function render(container, { supabase }) {
  loadPreviewFonts();
  container.append(
    Object.assign(document.createElement("h2"), { textContent: "로딩 화면" }),
  );
  await mountCardList(container, {
    supabase,
    table: "loading_items",
    description:
      "페이지를 열 때 무작위로 하나가 보입니다. 사용에 체크한 것만 나옵니다. 왼쪽 ⠿를 끌어 순서를 바꿀 수 있습니다.",
    imageRequired: true,
    fields: [
      { key: "text", label: "문구", type: "text", placeholder: "For Masterpieces" },
      { key: "font_family", label: "폰트", type: "select", options: () => LOADING_FONTS.map((f) => [f.name, f.label]) },
      { key: "font_size", label: "폰트 크기", type: "select", options: () => LOADING_SIZES, fallback: LOADING_SIZES[1][0] },
      {
        key: "font_weight",
        label: "두께",
        type: "select",
        dependsOn: "font_family",
        options: (v) => fontOf(v.font_family)?.weights ?? [],
      },
    ],
    defaults: () => ({ image_url: "" }),
    deleteConfirm: async (_row, index) => `${index + 1}번 로딩 화면을 삭제할까요?`,
    itemName: (_row, index) => `${index + 1}번 로딩 화면`,
    preview: (v) => {
      const caption = Object.assign(document.createElement("span"), {
        className: "loading-caption",
        textContent: v.text,
      });
      caption.style.fontFamily = `"${v.font_family}", "Paperlogy", cursive`;
      caption.style.fontSize = `clamp(${v.font_size})`;
      caption.style.fontWeight = v.font_weight;
      return [mediaPreview(v.image_url.trim()), caption];
    },
  });
}
