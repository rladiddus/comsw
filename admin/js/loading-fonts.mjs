// 로딩 문구에 쓸 수 있는 폰트(공개 사이트 supabase-client.js의 applyLoadingFont가 불러오는 것과 같음).
// 두께는 그 폰트 파일이 가진 것만. 크기는 사이트 CSS와 같은 clamp 세 값으로 저장한다.
export const LOADING_FONTS = [
  { name: "Paperlogy", label: "Paperlogy (기본)", weights: [["800", "800 ExtraBold"]], css: "../assets/fonts/paperlogy.css" },
  { name: "Great Vibes", label: "Great Vibes (필기체)", weights: [["400", "400 Regular"]], css: "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" },
];
export const LOADING_SIZES = [
  ["1rem, 2.5vw, 2rem", "작게"],
  ["1.25rem, 3.5vw, 3rem", "보통"],
  ["1.5rem, 4.5vw, 4rem", "크게"],
  ["2rem, 6vw, 5rem", "아주 크게"],
];

export const fontOf = (name) => LOADING_FONTS.find((f) => f.name === name);

// 관리 화면 미리보기용으로 폰트 파일을 한 번 불러온다.
export function loadPreviewFonts(doc = document) {
  for (const f of LOADING_FONTS) {
    if (doc.querySelector(`link[data-font="${f.name}"]`)) continue;
    const link = Object.assign(doc.createElement("link"), { rel: "stylesheet", href: f.css });
    link.dataset.font = f.name;
    doc.head.append(link);
  }
}
